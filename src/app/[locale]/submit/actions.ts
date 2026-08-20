"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { routing, isLocale, type Locale } from "@/i18n/routing";
import {
  notifyEditors,
  confirmToSubmitter,
  type ProposalSummary,
} from "@/lib/email";

/**
 * Proposal submission (SPEC.md §8).
 *
 * The insert runs **server-side with the service-role key**, and `proposals`
 * carries no anonymous insert policy at all. That is the whole design: an anon
 * insert would let a caller set `state`, `admin_notes` and `source_ip` freely,
 * which makes `source_ip` worthless for the rate limit below. Here the server
 * owns the IP, the initial state, and the file path it issued.
 */

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Service-role client. Server-only; never hand this to a component. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Caller's IP.
 *
 * Behind Vercel this is `x-forwarded-for`, whose first entry is the client.
 * It is spoofable in principle, which is why the rate limit is a speed bump
 * and the honeypot sits alongside it rather than either being relied on alone.
 */
async function callerIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return h.get("x-real-ip");
}

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX = 5;

/**
 * Rate limit, counted against `proposals` itself.
 *
 * Open decision D7 suggested a dedicated table. This uses the existing one
 * instead: `source_ip` and `created_at` are already there and server-owned, so
 * a separate table would be a second thing to keep correct for no extra
 * signal. If rejected attempts ever need counting too, that is the moment to
 * introduce one.
 */
async function overRateLimit(ip: string | null): Promise<boolean> {
  if (!ip) return false;

  const since = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000,
  ).toISOString();

  const supabase = serviceClient();
  const { count } = await supabase
    .from("proposals")
    .select("id", { count: "exact", head: true })
    .eq("source_ip", ip)
    .gte("created_at", since);

  return (count ?? 0) >= RATE_LIMIT_MAX;
}

export type ProposalInput = {
  name: string;
  email: string;
  affiliation: string;
  title: string;
  abstract: string;
  locale: string;
  coauthorNote: string;
  filePath: string;
  /** Honeypot: a real person never fills this, because it is not visible. */
  website: string;
};

export type SubmitResult =
  | { ok: true; emailDelivered: boolean }
  | { ok: false; error: string };

export async function submitProposal(
  input: ProposalInput,
): Promise<SubmitResult> {
  // Honeypot. Answer as though it succeeded: telling a bot which check it
  // failed is telling it how to pass next time.
  if (input.website.trim() !== "") {
    return { ok: true, emailDelivered: false };
  }

  const name = input.name.trim();
  const email = input.email.trim();
  const title = input.title.trim();
  const abstract = input.abstract.trim();

  if (!name || !email || !title || !abstract) {
    return { ok: false, error: "required" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "email" };
  }

  const locale: Locale = isLocale(input.locale)
    ? input.locale
    : routing.defaultLocale;

  const ip = await callerIp();
  if (await overRateLimit(ip)) {
    return { ok: false, error: "rate" };
  }

  const supabase = serviceClient();

  const { error } = await supabase.from("proposals").insert({
    name,
    email,
    affiliation: input.affiliation.trim() || null,
    title,
    abstract,
    locale,
    coauthor_note: input.coauthorNote.trim() || null,
    file_url: input.filePath.trim() || null,
    source_ip: ip,
    // state defaults to 'new'; it is not accepted from the client.
  });

  if (error) return { ok: false, error: "server" };

  const summary: ProposalSummary = {
    name,
    email,
    affiliation: input.affiliation.trim() || null,
    title,
    abstract,
    locale,
    coauthorNote: input.coauthorNote.trim() || null,
    hasAttachment: Boolean(input.filePath.trim()),
  };

  // The proposal is already saved. Email is notification, not the record: if
  // it fails the submitter still gets a success state, because their work has
  // in fact been received and an editor will see it in the inbox.
  const [editors] = await Promise.all([
    notifyEditors(summary),
    confirmToSubmitter(summary),
  ]);

  if (!editors.sent) {
    console.warn(
      `[proposals] saved but not emailed: ${editors.reason} — the proposal is ` +
        `in the inbox and nothing was lost.`,
    );
  }

  return { ok: true, emailDelivered: editors.sent };
}

export type UploadTicket =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

/**
 * Issues a signed upload URL for the private `proposals` bucket.
 *
 * The file never passes through this server. A 20 MB body cannot fit through a
 * Vercel function, and anonymous users cannot write to a private bucket, so
 * the only workable shape is a short-lived signed URL and a direct upload.
 */
export async function createProposalUpload(
  fileName: string,
  fileSize: number,
  fileType: string,
): Promise<UploadTicket> {
  if (fileSize > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "size" };
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(fileType)) {
    return { ok: false, error: "type" };
  }
  if (await overRateLimit(await callerIp())) {
    return { ok: false, error: "rate" };
  }

  // Server-chosen path: the client never names the object, so it cannot
  // overwrite an existing proposal or escape the folder.
  const extension = fileName.split(".").pop()?.toLowerCase().slice(0, 8) ?? "bin";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

  const supabase = serviceClient();
  const { data, error } = await supabase.storage
    .from("proposals")
    .createSignedUploadUrl(path);

  if (error || !data) return { ok: false, error: "server" };
  return { ok: true, path: data.path, token: data.token };
}

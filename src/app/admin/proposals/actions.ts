"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import type { Database } from "@/lib/supabase/database.types";

type ProposalState = Database["public"]["Enums"]["proposal_state"];

const STATES: readonly ProposalState[] = [
  "new", "contacted", "accepted", "declined", "spam",
];

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProposal(
  id: string,
  state: string,
  notes: string,
): Promise<ActionResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  if (!(STATES as readonly string[]).includes(state)) {
    return { ok: false, error: "Unknown status." };
  }

  // The editor's own session, so the staff policy on proposals applies.
  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("proposals")
    .update({ state: state as ProposalState, admin_notes: notes || null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/proposals");
  return { ok: true };
}

export type FileUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Short-lived signed URL for a proposal attachment.
 *
 * The `proposals` bucket is private and has no anon policy, so the signed URL
 * is minted server-side for a verified editor. It expires in five minutes:
 * long enough to open, short enough that a copied link is not a lasting way
 * around the bucket being private.
 */
export async function proposalFileUrl(path: string): Promise<FileUrlResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Storage is not configured." };

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.storage
    .from("proposals")
    .createSignedUrl(path, 300);

  if (error || !data) return { ok: false, error: "Could not open that file." };
  return { ok: true, url: data.signedUrl };
}

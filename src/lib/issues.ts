import { createPublicClient } from "./supabase/server";
import type { Locale } from "@/i18n/routing";

export type Issue = {
  id: string;
  volume: number;
  number: number;
  year: number;
  publishedAt: string | null;
  coverImageUrl: string | null;
  /** Optional special-issue title, in the requested locale where available. */
  title: string | null;
  description: string | null;
};

type IssueRow = {
  id: string;
  volume: number;
  number: number;
  year: number;
  published_at: string | null;
  cover_image_url: string | null;
  issue_translations: {
    locale: string;
    title: string | null;
    description: string | null;
  }[];
};

function toIssue(row: IssueRow, locale: Locale): Issue {
  // Issue titles are optional decoration (special issues), not the scholarly
  // record, so a plain preferred-then-any choice is enough here.
  const t =
    row.issue_translations.find((x) => x.locale === locale) ??
    row.issue_translations.find((x) => x.locale === "en") ??
    row.issue_translations[0];

  return {
    id: row.id,
    volume: row.volume,
    number: row.number,
    year: row.year,
    publishedAt: row.published_at,
    coverImageUrl: row.cover_image_url,
    title: t?.title ?? null,
    description: t?.description ?? null,
  };
}

const SELECT = `
  id, volume, number, year, published_at, cover_image_url,
  issue_translations ( locale, title, description )
`;

/** Published issues, newest first. */
export async function listIssues(locale: Locale): Promise<Issue[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("issues")
    .select(SELECT)
    .eq("state", "published")
    .order("volume", { ascending: false })
    .order("number", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as IssueRow[]).map((row) => toIssue(row, locale));
}

export async function getIssue(
  volume: number,
  number: number,
  locale: Locale,
): Promise<Issue | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("issues")
    .select(SELECT)
    .eq("state", "published")
    .eq("volume", volume)
    .eq("number", number)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toIssue(data as unknown as IssueRow, locale);
}

/**
 * A single issue's table of contents, in editorial order.
 *
 * Ordered by `position`, which is the order the editors set — not by page
 * number and not alphabetically. An issue's running order is an editorial
 * decision (SPEC.md §7.2).
 */
export { listIssueContents as getIssueContents } from "./articles";

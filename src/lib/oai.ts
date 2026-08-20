import { createPublicClient } from "./supabase/server";
import { journal, absoluteUrl, siteUrl } from "@/config/journal";
import type { Locale } from "@/i18n/routing";
import type { Database } from "./supabase/database.types";

type ArticleType = Database["public"]["Enums"]["article_type"];

const ARTICLE_TYPES: readonly ArticleType[] = [
  "research_article", "review_article", "case_study", "policy_note",
  "book_review", "editorial", "correction", "retraction",
];

/**
 * OAI-PMH 2.0 record assembly (SPEC.md §5.4).
 *
 * Two things this endpoint is deliberately *not*:
 *
 *  - It does not expose Weekly posts. OAI-PMH is the peer-reviewed record, and
 *    DOAJ and regional aggregators harvest it as such. An editorial column
 *    appearing here would be claiming a status it does not have.
 *  - It does not expose drafts. The query runs under the anon key, so RLS
 *    excludes them; that is a guarantee rather than a filter someone can
 *    forget to write.
 *
 * This is also the one place where all three locales appear together, and it
 * is correct here: `oai_dc` repeats `dc:title` and `dc:description` with
 * `xml:lang`, unlike the article page which emits one `citation_title` in the
 * primary language only.
 */

export const OAI_PAGE_SIZE = 100;

/**
 * Namespace part of the OAI identifier, e.g. `oai:example.org:slug`.
 *
 * `hostname`, not `host`: an OAI identifier is `oai:<namespace>:<local-id>`,
 * so a port would add a third colon and make every identifier in development
 * non-conformant while production silently looked fine.
 */
function repositoryHost(): string {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "localhost";
  }
}

export function oaiIdentifier(slug: string): string {
  return `oai:${repositoryHost()}:${slug}`;
}

export function slugFromIdentifier(identifier: string): string | null {
  const prefix = `oai:${repositoryHost()}:`;
  return identifier.startsWith(prefix)
    ? identifier.slice(prefix.length) || null
    : null;
}

export type OaiTranslation = {
  locale: Locale;
  title: string;
  abstract: string | null;
  keywords: string[];
};

export type OaiRecord = {
  slug: string;
  datestamp: string;
  publishedAt: string | null;
  primaryLanguage: Locale;
  type: string;
  doi: string | null;
  pdfUrl: string | null;
  firstPage: number | null;
  lastPage: number | null;
  license: string;
  volume: number | null;
  number: number | null;
  year: number | null;
  translations: OaiTranslation[];
  authors: string[];
};

type Row = {
  slug: string;
  updated_at: string;
  published_at: string | null;
  primary_language: string;
  type: string;
  doi: string | null;
  pdf_url: string | null;
  first_page: number | null;
  last_page: number | null;
  license: string;
  issues: { volume: number; number: number; year: number } | null;
  article_translations: {
    locale: string;
    title: string;
    abstract: string | null;
    keywords: string[] | null;
  }[];
  article_authors: {
    position: number;
    authors: { family_name: string; given_name: string };
  }[];
};

const SELECT = `
  slug, updated_at, published_at, primary_language, type, doi, pdf_url,
  first_page, last_page, license,
  issues ( volume, number, year ),
  article_translations ( locale, title, abstract, keywords ),
  article_authors ( position, authors ( family_name, given_name ) )
`;

function toRecord(row: Row): OaiRecord {
  return {
    slug: row.slug,
    // The OAI datestamp is when the record last changed, not when it was
    // published: selective harvesting (`from`/`until`) depends on that.
    datestamp: new Date(row.updated_at).toISOString().replace(/\.\d{3}Z$/, "Z"),
    publishedAt: row.published_at,
    primaryLanguage: row.primary_language as Locale,
    type: row.type,
    doi: row.doi,
    pdfUrl: row.pdf_url,
    firstPage: row.first_page,
    lastPage: row.last_page,
    license: row.license,
    volume: row.issues?.volume ?? null,
    number: row.issues?.number ?? null,
    year: row.issues?.year ?? null,
    translations: (row.article_translations ?? []).map((t) => ({
      locale: t.locale as Locale,
      title: t.title,
      abstract: t.abstract,
      keywords: t.keywords ?? [],
    })),
    authors: (row.article_authors ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((a) => `${a.authors.family_name}, ${a.authors.given_name}`),
  };
}

/** Sets a record belongs to. An online-first article belongs to no issue set. */
export function setsFor(record: OaiRecord): string[] {
  const sets = [`type:${record.type}`];
  if (record.volume !== null && record.number !== null) {
    sets.push(`issue:v${record.volume}n${record.number}`);
  }
  return sets;
}

export type ListQuery = {
  from?: string;
  until?: string;
  set?: string;
  offset: number;
};

export async function listRecords(
  query: ListQuery,
): Promise<{ records: OaiRecord[]; hasMore: boolean }> {
  const supabase = createPublicClient();

  let request = supabase
    .from("articles")
    .select(SELECT)
    .eq("state", "published")
    .order("updated_at", { ascending: true })
    // One extra row tells us whether another page exists without a count.
    .range(query.offset, query.offset + OAI_PAGE_SIZE);

  if (query.from) request = request.gte("updated_at", query.from);
  if (query.until) request = request.lte("updated_at", query.until);

  if (query.set?.startsWith("type:")) {
    // The set spec is untrusted input; narrow it to the enum before it
    // reaches the query, so an unknown type is an empty result rather than a
    // type error at the boundary.
    const candidate = query.set.slice("type:".length);
    if (!(ARTICLE_TYPES as readonly string[]).includes(candidate)) {
      return { records: [], hasMore: false };
    }
    request = request.eq("type", candidate as ArticleType);
  }

  const { data, error } = await request;
  if (error) throw error;

  let records = (data ?? []).map((row) => toRecord(row as unknown as Row));

  // Issue sets are filtered here rather than in the query: the volume and
  // number live on the joined issue, and PostgREST cannot express "the joined
  // row must match" without turning the join inner and dropping online-first
  // articles from every other set.
  if (query.set?.startsWith("issue:")) {
    const match = /^issue:v(\d+)n(\d+)$/.exec(query.set);
    if (!match) return { records: [], hasMore: false };
    const [, volume, number] = match;
    records = records.filter(
      (r) => r.volume === Number(volume) && r.number === Number(number),
    );
  }

  const hasMore = records.length > OAI_PAGE_SIZE;
  return { records: records.slice(0, OAI_PAGE_SIZE), hasMore };
}

export async function getRecord(slug: string): Promise<OaiRecord | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT)
    .eq("state", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? toRecord(data as unknown as Row) : null;
}

/** Earliest datestamp in the repository, for Identify. */
export async function earliestDatestamp(): Promise<string> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("articles")
    .select("updated_at")
    .eq("state", "published")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const iso = data?.updated_at ?? new Date().toISOString();
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Every set the repository currently has anything in. */
export async function listSets(): Promise<{ spec: string; name: string }[]> {
  const supabase = createPublicClient();

  const { data: types } = await supabase
    .from("articles")
    .select("type")
    .eq("state", "published");

  const { data: issues } = await supabase
    .from("issues")
    .select("volume, number, year")
    .eq("state", "published");

  const sets = new Map<string, string>();
  for (const row of types ?? []) {
    sets.set(`type:${row.type}`, row.type.replace(/_/g, " "));
  }
  for (const issue of issues ?? []) {
    sets.set(
      `issue:v${issue.volume}n${issue.number}`,
      `Volume ${issue.volume}, Issue ${issue.number} (${issue.year})`,
    );
  }

  return [...sets.entries()]
    .map(([spec, name]) => ({ spec, name }))
    .sort((a, b) => a.spec.localeCompare(b.spec));
}

/* ------------------------------------------------------------------ XML */

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function element(name: string, value: string, lang?: string): string {
  const attr = lang ? ` xml:lang="${xmlEscape(lang)}"` : "";
  return `<${name}${attr}>${xmlEscape(value)}</${name}>`;
}

/**
 * `oai_dc` for one record.
 *
 * Titles and descriptions are repeated per available translation with
 * `xml:lang`. Harvesters expect that, and it is the only correct way to
 * express a record that genuinely exists in several languages.
 */
export function dublinCore(record: OaiRecord): string {
  const parts: string[] = [];

  for (const t of record.translations) {
    parts.push(element("dc:title", t.title, t.locale));
  }
  for (const author of record.authors) {
    parts.push(element("dc:creator", author));
  }
  for (const t of record.translations) {
    for (const keyword of t.keywords) {
      parts.push(element("dc:subject", keyword, t.locale));
    }
  }
  for (const t of record.translations) {
    if (t.abstract) parts.push(element("dc:description", t.abstract, t.locale));
  }

  parts.push(element("dc:publisher", journal.publisher));
  if (record.publishedAt) {
    parts.push(element("dc:date", record.publishedAt.slice(0, 10)));
  }
  parts.push(element("dc:type", "Text"));
  parts.push(element("dc:type", record.type.replace(/_/g, " ")));
  if (record.pdfUrl) parts.push(element("dc:format", "application/pdf"));

  // The landing page first: it is the citable identifier for the record.
  parts.push(
    element(
      "dc:identifier",
      absoluteUrl(`/${record.primaryLanguage}/articles/${record.slug}`),
    ),
  );
  if (record.pdfUrl) parts.push(element("dc:identifier", record.pdfUrl));
  if (record.doi) {
    parts.push(element("dc:identifier", `https://doi.org/${record.doi}`));
  }

  parts.push(element("dc:language", record.primaryLanguage));

  const source =
    record.volume !== null
      ? `${journal.name}, ${record.volume}(${record.number})` +
        (record.firstPage !== null ? `, ${record.firstPage}-${record.lastPage}` : "")
      : journal.name;
  parts.push(element("dc:source", source));
  if (!journal.issn.startsWith("[")) {
    parts.push(element("dc:source", `ISSN ${journal.issn}`));
  }

  parts.push(element("dc:rights", record.license));

  return `<oai_dc:dc
    xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
    ${parts.join("\n    ")}
  </oai_dc:dc>`;
}

export function recordHeader(record: OaiRecord): string {
  const sets = setsFor(record)
    .map((s) => `<setSpec>${xmlEscape(s)}</setSpec>`)
    .join("");
  return `<header><identifier>${xmlEscape(
    oaiIdentifier(record.slug),
  )}</identifier><datestamp>${record.datestamp}</datestamp>${sets}</header>`;
}

/* ------------------------------------------------- resumption tokens */

export type ResumptionState = {
  offset: number;
  set?: string;
  from?: string;
  until?: string;
};

export function encodeToken(state: ResumptionState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeToken(token: string): ResumptionState | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    ) as ResumptionState;
    return typeof parsed.offset === "number" && parsed.offset >= 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

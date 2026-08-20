/**
 * Journal-level constants.
 *
 * SPEC.md §11 requires these live in one typed module rather than scattered
 * through components: they are read by the article page, the sitemap, the
 * OAI-PMH endpoint, and (eventually) the Crossref generator, so resolving a
 * placeholder should be a single edit.
 *
 * Values in [BRACKETS] are unresolved. Do not invent them — see SPEC.md
 * "Placeholders" and the pre-launch checklist in §12.
 */

/** Unresolved placeholders are typed so they cannot be mistaken for real values. */
export type Placeholder = `[${string}]`;

export const journal = {
  name: "Silk Road Economic Review",

  /** [ISSN] — pending from the National Library of Uzbekistan. */
  issn: "[ISSN]" satisfies Placeholder as string,

  /**
   * Short form for identifiers and file paths. Matches the journal name
   * rather than the publisher: `esu-je` was a stand-in from the DOI example
   * in SPEC.md §5.5, written before the title was settled.
   */
  shortName: "srer",

  publisher: "Economic Society of Uzbekistan",

  /**
   * Contact address published in OAI-PMH `Identify`. Harvesters and DOAJ both
   * read it, so it must be a real, monitored mailbox before launch. This also
   * becomes the destination for proposal notifications at build step 7.
   */
  adminEmail: process.env.EDITORIAL_EMAIL ?? "[EDITORIAL_EMAIL]",

  /**
   * DOIs are out of scope at this stage (SPEC.md §2). Nothing mints, requires,
   * or deposits one. The article page omits `citation_doi` when absent, so this
   * starts working by itself if a prefix is ever assigned.
   */
  doiPrefix: null as string | null,

  license: {
    name: "CC BY 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
} as const;

/**
 * Public origin, no trailing slash.
 *
 * Open decision D2. Permanence-constrained: it is baked into every canonical
 * URL, `citation_pdf_url`, and the sitemap. In development this is localhost;
 * production must set NEXT_PUBLIC_SITE_URL explicitly rather than inheriting a
 * Vercel preview domain, or canonical tags will point at a throwaway host.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Absolute URL for a path, for canonical tags and metadata. */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

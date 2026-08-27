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

/**
 * True when a config value is still an unresolved placeholder.
 *
 * Every emitter has to ask this, because a literal `[ISSN]` in machine-read
 * output is worse than the field being absent: Google Scholar and DOAJ index
 * it as the journal's actual ISSN. Three call sites hand-rolled
 * `startsWith("[")` and a fourth forgot to, which is exactly the failure mode
 * a shared predicate removes.
 */
export function isPlaceholder(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\[[A-Z_]+\]$/.test(value.trim());
}

/** The value, or null when it is still a placeholder. Safe to emit. */
export function resolved(value: string | null | undefined): string | null {
  return !value || isPlaceholder(value) ? null : value;
}

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

/**
 * Whether this origin is one the journal intends to keep.
 *
 * `localhost` and a `*.vercel.app` deployment URL are not. They are somewhere
 * the site happens to be running while D2 is unresolved.
 *
 * That matters more here than on most sites. Article URLs are promises
 * (`PRODUCT.md` principle 4, "Permanence outranks improvement"), and a URL
 * Google Scholar has indexed is very hard to withdraw — the scholarly record
 * would point at a host that is going to be abandoned. A provisional origin
 * that is also indexable is the one mistake this project cannot take back.
 *
 * So indexing is opt-in, and the opt-in is owning the domain you configure.
 * Resolving D2 is what turns the site on for crawlers; nothing else needs to
 * change.
 */
export function isProvisionalOrigin(origin: string = siteUrl): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    // An origin that will not parse is certainly not a domain we own.
    return true;
  }

  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === "vercel.app" ||
    host.endsWith(".vercel.app")
  );
}

/** True only on an origin the journal has committed to. */
export const siteIsIndexable = !isProvisionalOrigin();

/**
 * The same path in every locale, plus `x-default`.
 *
 * `hreflangAlternates` in citation.ts does this for articles, whose path is
 * built from a slug. This is the version for pages whose path is fixed, so
 * every listing carries the same language signals the article pages do.
 *
 * Pass an unprefixed path: "/issues", not "/en/issues".
 */
export function localeAlternates(
  path: string,
  locales: readonly string[],
  defaultLocale: string,
): Record<string, string> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const out: Record<string, string> = {};
  for (const locale of locales) out[locale] = absoluteUrl(`/${locale}${clean}`);
  out["x-default"] = absoluteUrl(`/${defaultLocale}${clean}`);
  return out;
}

/** Absolute URL for a path, for canonical tags and metadata. */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

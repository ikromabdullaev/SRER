import type { LocalisedArticle } from "./articles";
import { journal, absoluteUrl } from "@/config/journal";
import { routing, type Locale } from "@/i18n/routing";

export type MetaTag = { name: string; content: string };

/** Google Scholar wants `YYYY/MM/DD`. */
export function scholarDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
}

/** The article's canonical URL: the locale matching `primary_language` (§5.2). */
export function canonicalArticleUrl(article: {
  slug: string;
  primaryLanguage: Locale;
}): string {
  return absoluteUrl(`/${article.primaryLanguage}/articles/${article.slug}`);
}

export function articleUrl(slug: string, locale: Locale): string {
  return absoluteUrl(`/${locale}/articles/${slug}`);
}

export function hreflangAlternates(slug: string): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of routing.locales) {
    alternates[locale] = articleUrl(slug, locale);
  }
  alternates["x-default"] = articleUrl(slug, routing.defaultLocale);
  return alternates;
}

/**
 * The Google Scholar citation tags, in emission order.
 *
 * Three rules from SPEC.md §5.1 that this function exists to keep:
 *
 *  1. Emitted **once**, in the article's `primary_language` — never one set per
 *     locale. Only the canonical page calls this.
 *  2. `citation_author_institution` immediately follows the author it belongs
 *     to. That is why this returns an ordered array rather than an object:
 *     grouping the tags by name silently breaks the association.
 *  3. A tag with no value is omitted, not emitted empty. An online-first
 *     article has no volume, issue, or pages, and `<meta content="">` asserts
 *     that the value is blank rather than absent.
 */
export function citationTags(article: LocalisedArticle): MetaTag[] {
  const tags: MetaTag[] = [];
  const push = (name: string, content: string | number | null | undefined) => {
    if (content === null || content === undefined || content === "") return;
    tags.push({ name, content: String(content) });
  };

  push("citation_title", article.title);

  for (const author of article.authors) {
    // Latin canonical form, "Family, Given" — never the localised display name.
    push("citation_author", `${author.familyName}, ${author.givenName}`);
    push("citation_author_institution", author.affiliation);
  }

  push("citation_journal_title", journal.name);
  push("citation_issn", journal.issn);
  push("citation_volume", article.volume);
  push("citation_issue", article.number);
  push("citation_firstpage", article.firstPage);
  push("citation_lastpage", article.lastPage);

  if (article.publishedAt) {
    push("citation_publication_date", scholarDate(article.publishedAt));
    // Online first: no issue yet, so the publication date *is* the online date.
    // Once an issue is assigned, publication date becomes the issue date and
    // this stays, which is how Scholar establishes priority (§5.1).
    if (article.volume === null) {
      push("citation_online_date", scholarDate(article.publishedAt));
    }
  }

  // DOIs are out of scope at this stage (SPEC.md §2); this starts emitting by
  // itself if one is ever assigned.
  push("citation_doi", article.doi);

  push("citation_pdf_url", article.pdfUrl);
  push("citation_language", article.primaryLanguage);

  if (article.keywords.length > 0) {
    push("citation_keywords", article.keywords.join("; "));
  }

  return tags;
}

/** JSON-LD `ScholarlyArticle` (§5.3). */
export function articleJsonLd(article: LocalisedArticle): Record<string, unknown> {
  const url = canonicalArticleUrl(article);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "@id": url,
    url,
    headline: article.title,
    inLanguage: article.primaryLanguage,
    license: article.license,
    author: article.authors.map((author) => ({
      "@type": "Person",
      familyName: author.familyName,
      givenName: author.givenName,
      name: `${author.givenName} ${author.familyName}`,
      ...(author.orcid ? { identifier: `https://orcid.org/${author.orcid}` } : {}),
      ...(author.affiliation
        ? { affiliation: { "@type": "Organization", name: author.affiliation } }
        : {}),
    })),
  };

  if (article.publishedAt) jsonLd.datePublished = article.publishedAt;
  if (article.abstract) jsonLd.abstract = article.abstract;
  if (article.keywords.length > 0) jsonLd.keywords = article.keywords.join(", ");
  if (article.doi) jsonLd.identifier = `https://doi.org/${article.doi}`;

  const periodical = {
    "@type": "Periodical",
    name: journal.name,
    ...(journal.issn.startsWith("[") ? {} : { issn: journal.issn }),
  };

  jsonLd.isPartOf =
    article.volume !== null
      ? {
          "@type": "PublicationIssue",
          issueNumber: article.number,
          ...(article.volume !== null
            ? {
                isPartOf: {
                  "@type": "PublicationVolume",
                  volumeNumber: article.volume,
                  isPartOf: periodical,
                },
              }
            : {}),
        }
      : periodical;

  if (article.firstPage !== null) jsonLd.pageStart = article.firstPage;
  if (article.lastPage !== null) jsonLd.pageEnd = article.lastPage;

  return jsonLd;
}

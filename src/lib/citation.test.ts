import { describe, it, expect } from "vitest";
import { citationTags, scholarDate, canonicalArticleUrl } from "./citation";
import type { LocalisedArticle } from "./articles";

/**
 * These assert the rules from SPEC.md §5.1 that are easy to break and
 * expensive to notice: a mis-emitted citation tag does not throw, it just
 * quietly makes the journal unindexable.
 */

function article(overrides: Partial<LocalisedArticle> = {}): LocalisedArticle {
  return {
    id: "id-1",
    slug: "trade-openness-and-growth",
    doi: null,
    primaryLanguage: "en",
    type: "research_article",
    pdfUrl: "https://example.org/a.pdf",
    firstPage: 1,
    lastPage: 22,
    publishedAt: "2026-03-15T09:00:00Z",
    jelCodes: [],
    license: "CC BY 4.0",
    volume: 1,
    number: 1,
    year: 2026,
    title: "Trade openness and growth",
    titleLocale: "en",
    abstract: "An abstract.",
    abstractLocale: "en",
    keywords: ["trade", "growth"],
    keywordsLocale: "en",
    translationMissing: false,
    authors: [
      {
        id: "a1", familyName: "Karimov", givenName: "Aziz", orcid: null,
        position: 1, isCorresponding: true,
        displayName: "Каримов, Азиз", affiliation: "Tashkent State University",
      },
      {
        id: "a2", familyName: "Ivanova", givenName: "Elena", orcid: null,
        position: 2, isCorresponding: false,
        displayName: "Ivanova, Elena", affiliation: "HSE University",
      },
    ],
    ...overrides,
  };
}

const names = (tags: { name: string }[]) => tags.map((t) => t.name);
const value = (tags: { name: string; content: string }[], name: string) =>
  tags.find((t) => t.name === name)?.content;

describe("citationTags", () => {
  it("emits citation_title exactly once", () => {
    const tags = citationTags(article());
    expect(names(tags).filter((n) => n === "citation_title")).toHaveLength(1);
  });

  it("pairs each institution with the author it follows", () => {
    const tags = citationTags(article());
    const pairs = names(tags).filter(
      (n) => n === "citation_author" || n === "citation_author_institution",
    );
    // Not just "both present" — the ORDER is the whole point. Grouping the
    // authors together and the institutions after them is a silent corruption.
    expect(pairs).toEqual([
      "citation_author",
      "citation_author_institution",
      "citation_author",
      "citation_author_institution",
    ]);
  });

  it("uses the Latin canonical name, never the localised display name", () => {
    const tags = citationTags(article());
    const authors = tags.filter((t) => t.name === "citation_author");
    expect(authors[0].content).toBe("Karimov, Aziz");
    expect(authors[0].content).not.toContain("Каримов");
  });

  it("omits volume, issue and pages for an online-first article", () => {
    const tags = citationTags(
      article({ volume: null, number: null, firstPage: null, lastPage: null }),
    );
    for (const name of [
      "citation_volume",
      "citation_issue",
      "citation_firstpage",
      "citation_lastpage",
    ]) {
      expect(names(tags)).not.toContain(name);
    }
    // An online-first article gets an online date instead.
    expect(value(tags, "citation_online_date")).toBe("2026/03/15");
  });

  it("never emits an empty tag", () => {
    const tags = citationTags(article({ pdfUrl: null, keywords: [] }));
    expect(tags.every((t) => t.content.length > 0)).toBe(true);
    expect(names(tags)).not.toContain("citation_pdf_url");
    expect(names(tags)).not.toContain("citation_keywords");
  });

  it("omits citation_doi while DOIs are out of scope", () => {
    expect(names(citationTags(article()))).not.toContain("citation_doi");
    // ...and starts emitting by itself if one is ever assigned.
    expect(value(citationTags(article({ doi: "10.1/x" })), "citation_doi")).toBe(
      "10.1/x",
    );
  });

  it("reports the primary language, not the requested one", () => {
    const tags = citationTags(article({ primaryLanguage: "uz", titleLocale: "uz" }));
    expect(value(tags, "citation_language")).toBe("uz");
  });
});

describe("canonicalArticleUrl", () => {
  it("points at the primary-language locale", () => {
    expect(canonicalArticleUrl({ slug: "x", primaryLanguage: "uz" })).toMatch(
      /\/uz\/articles\/x$/,
    );
  });
});

describe("scholarDate", () => {
  it("formats as YYYY/MM/DD with zero padding", () => {
    expect(scholarDate("2026-03-05T00:00:00Z")).toBe("2026/03/05");
  });
});

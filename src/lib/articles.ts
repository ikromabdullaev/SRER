import { createPublicClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";
import type { Locale } from "@/i18n/routing";

type LocalisedRow =
  Database["public"]["Views"]["published_articles_localised"]["Row"];

/** An author as the article page needs them, in author order. */
export type ArticleAuthor = {
  id: string;
  /** Latin canonical forms. `citation_author` uses these, never the localised ones. */
  familyName: string;
  givenName: string;
  orcid: string | null;
  position: number;
  isCorresponding: boolean;
  /** Localised display name and affiliation, falling back to the Latin form. */
  displayName: string;
  affiliation: string | null;
};

export type LocalisedArticle = {
  id: string;
  slug: string;
  doi: string | null;
  primaryLanguage: Locale;
  type: Database["public"]["Enums"]["article_type"];
  pdfUrl: string | null;
  firstPage: number | null;
  lastPage: number | null;
  publishedAt: string | null;
  jelCodes: string[];
  license: string;
  volume: number | null;
  number: number | null;
  year: number | null;
  title: string;
  titleLocale: Locale;
  abstract: string | null;
  abstractLocale: Locale | null;
  keywords: string[];
  keywordsLocale: Locale | null;
  /** True when no translation row existed for the requested locale at all. */
  translationMissing: boolean;
  authors: ArticleAuthor[];
};

/**
 * The fields the view guarantees for a published article. `title` is nullable
 * in the generated types because a view cannot express not-null, but the
 * database enforces it: a published article must have a primary-language title
 * (SCHEMA.md → Triggers). A row that violates that is a bug, not a state to
 * render around.
 */
function assertRenderable(row: LocalisedRow): asserts row is LocalisedRow & {
  id: string;
  slug: string;
  title: string;
  title_locale: Locale;
  primary_language: Locale;
} {
  if (!row.id || !row.slug || !row.title || !row.title_locale) {
    throw new Error(
      `published article ${row.slug ?? row.id} has no resolvable title; ` +
        "the primary-translation trigger should have prevented this",
    );
  }
}

/**
 * One article, resolved for a locale.
 *
 * Locale fallback is done in SQL by `published_articles_localised`, not here —
 * SCHEMA.md resolves the chain (requested → primary_language → en → any) per
 * field, so a half-filled translation contributes its title without also
 * contributing its missing abstract. Reimplementing that in TypeScript would
 * mean two implementations that disagree.
 */
export async function getArticle(
  slug: string,
  locale: Locale,
): Promise<LocalisedArticle | null> {
  const supabase = createPublicClient();

  const { data: row, error } = await supabase
    .from("published_articles_localised")
    .select("*")
    .eq("slug", slug)
    .eq("requested_locale", locale)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  assertRenderable(row);

  return { ...toArticle(row), authors: await getAuthors(row.id, locale) };
}

/** Every published article, for `generateStaticParams` and the sitemap. */
export async function getPublishedSlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug")
    .eq("state", "published");

  if (error) throw error;
  return (data ?? []).map((row) => row.slug);
}

/**
 * Authors in author order, with localised display forms.
 *
 * Note the explicit column list on `authors`. `select('*')` fails outright for
 * the anon role: `email` is withheld by a column-level grant (SCHEMA.md →
 * Grants), so a star-select is a permission error rather than a filtered row.
 */
async function getAuthors(
  articleId: string,
  locale: Locale,
): Promise<ArticleAuthor[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("article_authors")
    .select(
      `position,
       is_corresponding,
       authors!inner (
         id, family_name, given_name, orcid,
         author_translations ( locale, display_name, affiliation )
       )`,
    )
    .eq("article_id", articleId)
    .order("position");

  if (error) throw error;

  return (data ?? []).map((row) => {
    const author = row.authors;
    const translations = author.author_translations ?? [];
    const preferred =
      translations.find((t) => t.locale === locale) ??
      translations.find((t) => t.locale === "en") ??
      translations[0];

    return {
      id: author.id,
      familyName: author.family_name,
      givenName: author.given_name,
      orcid: author.orcid,
      position: row.position,
      isCorresponding: row.is_corresponding,
      displayName:
        preferred?.display_name ?? `${author.family_name}, ${author.given_name}`,
      affiliation: preferred?.affiliation ?? null,
    };
  });
}

function toArticle(
  row: LocalisedRow & { id: string; slug: string; title: string },
): Omit<LocalisedArticle, "authors"> {
  return {
    id: row.id,
    slug: row.slug,
    doi: row.doi,
    primaryLanguage: row.primary_language as Locale,
    type: row.type ?? "research_article",
    pdfUrl: row.pdf_url,
    firstPage: row.first_page,
    lastPage: row.last_page,
    publishedAt: row.published_at,
    jelCodes: row.jel_codes ?? [],
    license: row.license ?? "CC BY 4.0",
    volume: row.volume,
    number: row.number,
    year: row.year,
    title: row.title,
    titleLocale: row.title_locale as Locale,
    abstract: row.abstract,
    abstractLocale: (row.abstract_locale as Locale | null) ?? null,
    keywords: row.keywords ?? [],
    keywordsLocale: (row.keywords_locale as Locale | null) ?? null,
    translationMissing: row.translation_missing ?? false,
  };
}

/**
 * Published articles for a locale, newest first.
 *
 * Ordered by `published_at`, not by issue year: an online-first article has no
 * issue, so ordering through the join would drop it entirely (SPEC.md §6 makes
 * the same point about the year filter).
 */
export async function listArticles(locale: Locale): Promise<LocalisedArticle[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("published_articles_localised")
    .select("*")
    .eq("requested_locale", locale)
    .order("published_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    assertRenderable(row);
    return { ...toArticle(row), authors: [] };
  });
}

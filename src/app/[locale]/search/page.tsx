import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { searchArticles, type ArticleFilters } from "@/lib/search";
import { SearchForm } from "@/components/search-form";
import { Pagination } from "@/components/pagination";
import type { Database } from "@/lib/supabase/database.types";

type ArticleType = Database["public"]["Enums"]["article_type"];

const ARTICLE_TYPES: ArticleType[] = [
  "research_article",
  "review_article",
  "case_study",
  "policy_note",
  "book_review",
  "editorial",
  "correction",
  "retraction",
];

function parseType(value?: string): ArticleType | undefined {
  return value && (ARTICLE_TYPES as string[]).includes(value)
    ? (value as ArticleType)
    : undefined;
}

/**
 * Article search.
 *
 * Dynamic by necessity: the query lives in the URL. That is fine — search
 * results are not the indexable scholarly record, the article pages are, and
 * those remain static.
 *
 * An empty query with filters applied is a valid browse view (SPEC.md §6),
 * not an error state.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const query = sp.q ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const filters: ArticleFilters = {
    type: parseType(sp.type),
    year: sp.year ? Number(sp.year) || undefined : undefined,
    jel: sp.jel || undefined,
    allLocales: sp.all === "1",
  };

  const t = await getTranslations("search");
  const tArticle = await getTranslations("article");
  const tNav = await getTranslations("nav");

  const results = await searchArticles(query, locale as Locale, filters, page);

  return (
    <div className="shell">
      <header className="page-head">
        <div>
          <h1>{t("title")}</h1>
        </div>
        <p className="page-head__fact">
          {t("resultCount", { count: results.total })}
        </p>
      </header>

      <SearchForm
        query={query}
        allLocales={filters.allLocales ?? false}
        type={sp.type ?? ""}
        year={sp.year ?? ""}
        jel={sp.jel ?? ""}
        types={ARTICLE_TYPES}
        labels={{
          queryLabel: t("queryLabel"),
          submit: t("submit"),
          allLanguages: t("allLanguages"),
          type: t("filterType"),
          year: t("filterYear"),
          jel: t("filterJel"),
          any: t("any"),
          reset: t("reset"),
        }}
      />

      {results.total === 0 ? (
        <p className="empty">{t("noResults")}</p>
      ) : (
        <ul className="article-list">
          {results.hits.map((hit) => (
            <li key={hit.id}>
              <Link href={`/articles/${hit.slug}`}>
                <span lang={localeHtmlLang[hit.matched_locale as Locale]}>
                  {hit.title}
                </span>
              </Link>
              <div className="article__meta">
                {hit.volume !== null && hit.number !== null
                  ? tArticle("issueLine", {
                      volume: hit.volume,
                      number: hit.number,
                      year: hit.published_at
                        ? new Date(hit.published_at).getUTCFullYear()
                        : "",
                    })
                  : tNav("onlineFirst")}
                {/* When searching across languages, say which one matched --
                    a Russian title in a list of English ones is otherwise
                    just confusing. */}
                {filters.allLocales &&
                  ` · ${hit.matched_locale.toUpperCase()}`}
              </div>
              {hit.abstract && (
                <p lang={localeHtmlLang[hit.matched_locale as Locale]}>
                  {hit.abstract.slice(0, 240)}
                  {hit.abstract.length > 240 ? "…" : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={results.page}
        pageCount={results.pageCount}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageLabel={t("pageOf", { page: results.page, total: results.pageCount })}
      />
    </div>
  );
}

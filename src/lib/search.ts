import { createPublicClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";
import type { Locale } from "@/i18n/routing";

type ArticleHit =
  Database["public"]["Functions"]["search_articles"]["Returns"][number];
type PostHit =
  Database["public"]["Functions"]["search_posts"]["Returns"][number];

export const PAGE_SIZE = 10;

export type ArticleResults = {
  hits: ArticleHit[];
  total: number;
  page: number;
  pageCount: number;
};

export type ArticleFilters = {
  type?: Database["public"]["Enums"]["article_type"];
  year?: number;
  jel?: string;
  allLocales?: boolean;
};

/**
 * Article search.
 *
 * Ranking, per-locale normalisation, the Uzbek trigram blend, author matching
 * and de-duplication all happen in `search_articles` (SCHEMA.md → Search).
 * This function's job is paging and shaping, not scoring — if ranking needs
 * changing, change the SQL, not this.
 */
export async function searchArticles(
  query: string,
  locale: Locale,
  filters: ArticleFilters = {},
  page = 1,
): Promise<ArticleResults> {
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("search_articles", {
    search_query: query,
    in_locale: locale,
    all_locales: filters.allLocales ?? false,
    filter_type: filters.type ?? undefined,
    filter_year: filters.year ?? undefined,
    filter_jel: filters.jel ?? undefined,
    page_limit: PAGE_SIZE,
    page_offset: (page - 1) * PAGE_SIZE,
  });

  if (error) throw error;

  const hits = data ?? [];
  // `total` is a window count carried on every row, so an empty page means
  // zero results rather than an unknown total.
  const total = hits.length > 0 ? Number(hits[0].total) : 0;

  return {
    hits,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type PostResults = {
  hits: PostHit[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Weekly search — a separate index and a separate result list.
 *
 * Posts and articles are never merged into one set of results: they are two
 * different categories (SPEC.md → Weekly → Search).
 */
export async function searchPosts(
  query: string,
  filterLocale?: Locale,
  page = 1,
): Promise<PostResults> {
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("search_posts", {
    search_query: query,
    filter_locale: filterLocale ?? undefined,
    page_limit: PAGE_SIZE,
    page_offset: (page - 1) * PAGE_SIZE,
  });

  if (error) throw error;

  const hits = data ?? [];
  const total = hits.length > 0 ? Number(hits[0].total) : 0;

  return {
    hits,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

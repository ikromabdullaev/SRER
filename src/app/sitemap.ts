import type { MetadataRoute } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl } from "@/config/journal";
import { getPublishedSlugs, getAuthorSlugs } from "@/lib/articles";
import { listIssues } from "@/lib/issues";
import { getPostRoutes } from "@/lib/posts";

/**
 * Sitemap (SPEC.md §5.6).
 *
 * Every locale variant of every published article, issue, static page and
 * Weekly post, each entry carrying its `hreflang` alternates.
 *
 * Drafts never appear: everything here comes from queries running under the
 * anon key, so RLS excludes them rather than a filter someone has to remember.
 */
export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

/** One entry per locale, each listing all locales as alternates. */
function forEachLocale(
  path: (locale: Locale) => string,
  options: Omit<Entry, "url" | "alternates"> = {},
): Entry[] {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(path(locale));
  }

  return routing.locales.map((locale) => ({
    url: absoluteUrl(path(locale)),
    alternates: { languages },
    ...options,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, issues, authorSlugs, postRoutes] = await Promise.all([
    getPublishedSlugs(),
    listIssues(routing.defaultLocale),
    getAuthorSlugs(),
    getPostRoutes(),
  ]);

  const entries: Entry[] = [];

  // Static pages.
  entries.push(...forEachLocale((l) => `/${l}`, { priority: 1 }));
  for (const path of [
    "issues",
    "online-first",
    "weekly",
    "search",
    "about",
    "editorial-board",
    "for-authors",
    "submit",
  ]) {
    entries.push(...forEachLocale((l) => `/${l}/${path}`, { priority: 0.5 }));
  }

  // Articles — the reason the sitemap exists.
  for (const slug of slugs) {
    entries.push(
      ...forEachLocale((l) => `/${l}/articles/${slug}`, { priority: 0.9 }),
    );
  }

  for (const issue of issues) {
    entries.push(
      ...forEachLocale(
        (l) => `/${l}/issues/${issue.volume}/${issue.number}`,
        { priority: 0.6 },
      ),
    );
  }

  for (const slug of authorSlugs) {
    entries.push(
      ...forEachLocale((l) => `/${l}/authors/${slug}`, { priority: 0.4 }),
    );
  }

  // Weekly posts exist only in the languages they were written in, so their
  // entries and alternates list exactly those — unlike articles, which exist
  // in every locale by way of fallback. Advertising a locale that only
  // redirects would misdescribe the site to a crawler.
  const byPost = new Map<string, { handle: string; slug: string; locales: Locale[] }>();
  for (const route of postRoutes) {
    const key = `${route.handle}/${route.slug}`;
    const existing = byPost.get(key);
    if (existing) existing.locales.push(route.locale);
    else byPost.set(key, { handle: route.handle, slug: route.slug, locales: [route.locale] });
  }

  for (const post of byPost.values()) {
    const languages: Record<string, string> = {};
    for (const locale of post.locales) {
      languages[locale] = absoluteUrl(`/${locale}/weekly/${post.handle}/${post.slug}`);
    }
    for (const locale of post.locales) {
      entries.push({
        url: absoluteUrl(`/${locale}/weekly/${post.handle}/${post.slug}`),
        alternates: { languages },
        priority: 0.5,
      });
    }
  }

  return entries;
}

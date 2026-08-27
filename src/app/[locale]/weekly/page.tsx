import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isLocale, type Locale } from "@/i18n/routing";
import { listPosts } from "@/lib/posts";
import { PostCard } from "@/components/post-card";
import { LanguageFilter } from "@/components/language-filter";

/**
 * The Weekly listing.
 *
 * Dynamic, not prerendered, because of the `lang` filter in the query string.
 * That is fine here: Weekly is not the scholarly record, so it carries none of
 * the static-generation obligations that make the article page static (§5.1).
 * Individual posts are still prerendered.
 */
export default async function WeeklyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { locale } = await params;
  const { lang } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("weekly");

  // Filtering by language REMOVES posts that lack it. No fallback, no notice —
  // the opposite of how articles behave, and deliberately so (SPEC.md → Weekly).
  const filterLocale = lang && isLocale(lang) ? lang : undefined;
  const posts = await listPosts(locale as Locale, { filterLocale });

  return (
    <div className="shell">
      <header className="page-head">
        <div>
          <h1>{t("title")}</h1>
          <p className="page-head__lede">{t("lede")}</p>
        </div>
        {/* The filter belongs on the rule with the heading: on this page it
            is the control that decides what the list below even contains. */}
        <LanguageFilter
          current={filterLocale ?? null}
          label={t("filterLabel")}
          allLabel={t("filterAll")}
        />
      </header>

      {posts.length === 0 ? (
        <p className="empty">{t("none")}</p>
      ) : (
        <ul className="article-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              byline={t("byline", { name: post.author.fullName })}
              availableIn={t("availableIn")}
              locale={locale as Locale}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

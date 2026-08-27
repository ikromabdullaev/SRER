import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  getAuthorBySlug,
  getAuthorSlugs,
  listArticlesByAuthor,
} from "@/lib/articles";

/**
 * An author page, routed on a slug rather than a UUID (open decision D6).
 * These URLs get indexed, so they are effectively permanent.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getAuthorSlugs();
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const author = await getAuthorBySlug(slug, locale as Locale);
  if (!author) notFound();

  const t = await getTranslations("author");
  const articles = await listArticlesByAuthor(author.id, locale as Locale);

  return (
    <div className="shell">
      <header className="page-head">
        <div>
          <h1>{author.displayName}</h1>
          {author.affiliation && (
            <p className="page-head__lede">{author.affiliation}</p>
          )}
        </div>
      </header>

      {/* One fact per row, the same record the article page keeps. */}
      {(author.orcid || author.websiteUrl) && (
        <dl className="facts facts--wide">
          {author.orcid && (
            <div>
              <dt>{t("orcid")}</dt>
              <dd>
                <a href={`https://orcid.org/${author.orcid}`}>{author.orcid}</a>
              </dd>
            </div>
          )}
          {author.websiteUrl && (
            <div>
              <dt>{t("website")}</dt>
              <dd>
                <a href={author.websiteUrl}>{author.websiteUrl}</a>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="section__head">
        <h2>{t("articles")}</h2>
      </div>
      {articles.length === 0 ? (
        <p className="empty">{t("noArticles")}</p>
      ) : (
        <ul className="article-list">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.slug}`}>
                <span lang={localeHtmlLang[article.titleLocale]}>
                  {article.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

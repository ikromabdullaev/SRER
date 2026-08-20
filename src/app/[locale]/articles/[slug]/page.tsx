import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getArticle, getPublishedSlugs } from "@/lib/articles";
import {
  canonicalArticleUrl,
  citationTags,
  articleJsonLd,
  hreflangAlternates,
} from "@/lib/citation";
import { journal } from "@/config/journal";

/**
 * The highest-value page in the project (SPEC.md §10 step 3).
 *
 * Everything here is server-rendered into the initial HTML. A client fetch of
 * any of this metadata means Google Scholar sees an empty document and the
 * journal is invisible. Verify by viewing source, not devtools: devtools shows
 * the hydrated DOM, which is exactly the thing that would lie to you here.
 *
 * The composition is the scientific-publication setting: the reading column
 * holds the argument, the facts column holds the record. Every row in that
 * column is one fact — issue, pages, dates, licence — and nothing in it is
 * ornament.
 */

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const article = await getArticle(slug, locale as Locale);
  if (!article) return {};

  return {
    title: `${article.title} — ${journal.name}`,
    description: article.abstract ?? undefined,
    alternates: {
      canonical: canonicalArticleUrl(article),
      languages: hreflangAlternates(article.slug),
    },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.abstract ?? undefined,
      url: canonicalArticleUrl(article),
      siteName: journal.name,
      locale,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const article = await getArticle(slug, locale as Locale);
  if (!article) notFound();

  const t = await getTranslations("article");
  const tLocale = await getTranslations("locale");

  // citation_* tags belong to the canonical page only. Emitting a set per
  // locale is the single most damaging thing this page could do: Scholar
  // indexes the result as three competing records for one article.
  const isCanonical = locale === article.primaryLanguage;
  const tags = isCanonical ? citationTags(article) : [];

  const longDate = new Intl.DateTimeFormat(localeHtmlLang[locale as Locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const abstractLocale = article.abstractLocale ?? article.primaryLanguage;

  return (
    <div className="shell">
      <article className="article">
        {/*
          React hoists these into <head>. They are written as JSX rather than
          going through `metadata.other` because that groups tags by name, and
          citation_author_institution has to follow the author it belongs to.
        */}
        {tags.map((tag, i) => (
          <meta key={`${tag.name}-${i}`} name={tag.name} content={tag.content} />
        ))}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(articleJsonLd(article)),
          }}
        />

        <div>
          <h1 lang={localeHtmlLang[article.titleLocale]}>{article.title}</h1>

          {article.translationMissing && (
            <p className="notice">
              {t("titleFallbackNotice", {
                language: tLocale(locale as Locale),
                shown: tLocale(article.titleLocale),
              })}
            </p>
          )}

          <ul className="authors">
            {article.authors.map((author) => (
              <li key={author.id}>
                <span className="authors__name">{author.displayName}</span>
                {author.isCorresponding && (
                  <>
                    {" "}
                    <span className="authors__corr">
                      {t("correspondingAuthor")}
                    </span>
                  </>
                )}
                {author.affiliation && (
                  <div className="authors__affil">{author.affiliation}</div>
                )}
              </li>
            ))}
          </ul>

          <h2>{t("abstract")}</h2>

          {article.abstract ? (
            <>
              {abstractLocale !== locale && (
                <p className="notice">
                  {t("translationMissing", {
                    language: tLocale(locale as Locale),
                    shown: tLocale(abstractLocale),
                  })}
                </p>
              )}
              <p className="abstract" lang={localeHtmlLang[abstractLocale]}>
                {article.abstract}
              </p>
            </>
          ) : (
            <p className="notice">
              {t("translationMissing", {
                language: tLocale(locale as Locale),
                shown: tLocale(article.primaryLanguage),
              })}
            </p>
          )}

          {article.keywords.length > 0 && (
            <>
              <h2>{t("keywords")}</h2>
              <ul
                className="keywords"
                lang={localeHtmlLang[article.keywordsLocale ?? article.primaryLanguage]}
              >
                {article.keywords.map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* The record. One fact per row; nothing here is decoration. */}
        <aside>
          {article.pdfUrl && (
            <p>
              {/*
                Direct, permanent, unauthenticated (SPEC.md §5.1). Same URL as
                citation_pdf_url, and Scholar follows it.
              */}
              <a className="pdf" href={article.pdfUrl}>
                {t("downloadPdf")}
              </a>
            </p>
          )}

          <dl className="facts">
            {/* The article's kind is a fact about it, listed with the other
                facts. It was briefly an eyebrow above the title, which is a
                label telling you what you are about to read instead of
                letting the title do it. */}
            <div>
              <dt>{t("typeLabel")}</dt>
              <dd>{t(`type.${article.type}` as "type.research_article")}</dd>
            </div>

            {article.volume !== null && article.number !== null ? (
              <div>
                <dt>{t("issueLabel")}</dt>
                <dd>
                  <Link href={`/issues/${article.volume}/${article.number}`}>
                    {t("issueLine", {
                      volume: article.volume,
                      number: article.number,
                      year: article.year ?? "",
                    })}
                  </Link>
                </dd>
              </div>
            ) : (
              <div>
                <dt>{t("issueLabel")}</dt>
                <dd>{t("onlineFirstNotice")}</dd>
              </div>
            )}

            {article.firstPage !== null && article.lastPage !== null && (
              <div>
                <dt>{t("pagesLabel")}</dt>
                <dd>
                  {article.firstPage}–{article.lastPage}
                </dd>
              </div>
            )}

            {article.publishedAt && (
              <div>
                <dt>{t("publishedLabel")}</dt>
                <dd>
                  <time dateTime={article.publishedAt}>
                    {longDate.format(new Date(article.publishedAt))}
                  </time>
                </dd>
              </div>
            )}

            {article.jelCodes.length > 0 && (
              <div>
                <dt>JEL</dt>
                <dd>{article.jelCodes.join(", ")}</dd>
              </div>
            )}

            <div>
              <dt>{t("licence")}</dt>
              <dd>
                <a href={journal.license.url} rel="license">
                  {article.license}
                </a>
              </dd>
            </div>
          </dl>
        </aside>
      </article>
    </div>
  );
}

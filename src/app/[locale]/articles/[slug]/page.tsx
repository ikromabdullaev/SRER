import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
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
 * journal is invisible — which is the failure the whole architecture is shaped
 * to avoid. Verify by viewing source, not devtools: devtools shows the
 * hydrated DOM, which is exactly the thing that would lie to you here.
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
    title: article.title,
    description: article.abstract ?? undefined,
    alternates: {
      // The canonical page is the primary-language one. Non-canonical locale
      // pages carry the full hreflang set and point their canonical here.
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

  const dateFormat = new Intl.DateTimeFormat(localeHtmlLang[locale as Locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <article>
      {/*
        React hoists these into <head>. They are written as JSX rather than
        going through `metadata.other` because that groups tags by name, and
        `citation_author_institution` has to follow the author it belongs to.
      */}
      {tags.map((tag, i) => (
        <meta key={`${tag.name}-${i}`} name={tag.name} content={tag.content} />
      ))}

      <script
        type="application/ld+json"
        // Server-rendered constant derived from our own database, not user input.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(article)),
        }}
      />

      <h1 lang={localeHtmlLang[article.titleLocale]}>{article.title}</h1>

      {article.translationMissing && (
        <p className="notice">
          {t("titleFallbackNotice", {
            language: tLocale(locale as Locale),
            shown: tLocale(article.titleLocale),
          })}
        </p>
      )}

      <p className="article__meta">
        {article.volume !== null && article.number !== null ? (
          <span>
            {t("issueLine", {
              volume: article.volume,
              number: article.number,
              year: article.year ?? "",
            })}
          </span>
        ) : (
          <span>{t("onlineFirstNotice")}</span>
        )}
        {article.firstPage !== null && article.lastPage !== null && (
          <>
            {" · "}
            {t("pages", { first: article.firstPage, last: article.lastPage })}
          </>
        )}
        {article.publishedAt && (
          <>
            {" · "}
            {t("published", { date: dateFormat.format(new Date(article.publishedAt)) })}
          </>
        )}
      </p>

      <h2>{t("authors")}</h2>
      <ul className="article__authors">
        {article.authors.map((author) => (
          <li key={author.id}>
            {author.displayName}
            {author.isCorresponding && ` (${t("correspondingAuthor")})`}
            {author.affiliation && (
              <div className="article__affiliation">{author.affiliation}</div>
            )}
          </li>
        ))}
      </ul>

      {article.pdfUrl && (
        <p>
          {/*
            Direct, permanent, unauthenticated link to the PDF (§5.1). No
            redirect, no signed URL, no expiry — this is the same URL as
            citation_pdf_url, and Scholar follows it.
          */}
          <a href={article.pdfUrl}>{t("downloadPdf")}</a>
        </p>
      )}

      <h2>{t("abstract")}</h2>
      {article.abstract ? (
        <>
          {article.abstractLocale !== locale && (
            <p className="notice">
              {t("translationMissing", {
                language: tLocale(locale as Locale),
                shown: tLocale(article.abstractLocale ?? article.primaryLanguage),
              })}
            </p>
          )}
          <p lang={localeHtmlLang[article.abstractLocale ?? article.primaryLanguage]}>
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

      <p className="article__meta">
        {t("licence")}: {article.license}
      </p>
    </article>
  );
}

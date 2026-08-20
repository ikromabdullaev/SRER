import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getPost, getPostLocales, getPostRoutes } from "@/lib/posts";
import { absoluteUrl, journal } from "@/config/journal";

/**
 * A single Weekly post.
 *
 * Note what this page does NOT emit: no `citation_*` tags. Telling Google
 * Scholar that an editorial column is a peer-reviewed journal article would
 * dilute the journal's scholarly record, and DOAJ assesses what a journal
 * claims as content (SPEC.md → Weekly). Posts get ordinary `Article` JSON-LD.
 */

export async function generateStaticParams() {
  // Only the locales a post exists in are prerendered. The rest are redirects
  // resolved at request time, not generated pages.
  return getPostRoutes();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; handle: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, handle, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const post = await getPost(handle, slug, locale as Locale);
  if (!post) return {};

  const path = `/weekly/${handle}/${slug}`;

  // hreflang lists only the languages the post was actually written in.
  // Advertising an alternate that redirects elsewhere would be a lie to a
  // crawler, and crawlers remember.
  const languages: Record<string, string> = {};
  for (const l of post.availableLocales) {
    languages[l] = absoluteUrl(`/${l}${path}`);
  }

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}${path}`),
      languages,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt ?? undefined,
      siteName: journal.name,
      locale,
    },
  };
}

export default async function WeeklyPostPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string; slug: string }>;
}) {
  const { locale, handle, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const post = await getPost(handle, slug, locale as Locale);

  if (!post) {
    /**
     * The post may still exist — just not in this language.
     *
     * Redirect to a language it does exist in rather than 404ing, so a link
     * shared into a Russian-language conversation still opens for a reader
     * whose site language is Russian. What we do not do is render an English
     * post at a Russian URL: that would publish thin duplicates in languages
     * nobody wrote.
     */
    const available = await getPostLocales(handle, slug);
    if (available.length === 0) notFound();

    const target = available[0];
    const href = `/${target}/weekly/${handle}/${slug}`;
    // typedRoutes cannot validate this: the path is computed from database
    // content at request time, not read off the route tree. 308 rather than
    // 307 -- which language a post exists in is a property of the post, not a
    // temporary condition.
    permanentRedirect(href as Parameters<typeof permanentRedirect>[0]);
  }

  const t = await getTranslations("weekly");
  const dateFormat = new Intl.DateTimeFormat(localeHtmlLang[locale as Locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    inLanguage: post.locale,
    author: { "@type": "Person", name: post.author.fullName },
    publisher: { "@type": "Organization", name: journal.publisher },
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.excerpt ? { description: post.excerpt } : {}),
  };

  return (
    <article lang={localeHtmlLang[post.locale]}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1>{post.title}</h1>

      <p className="article__meta">
        <Link href={`/weekly/${post.author.handle}`}>
          {t("byline", { name: post.author.fullName })}
        </Link>
        {post.publishedAt && ` · ${dateFormat.format(new Date(post.publishedAt))}`}
        {" · "}
        {t("availableIn")}:{" "}
        {post.availableLocales.map((l) => l.toUpperCase()).join(" / ")}
      </p>

      {/*
        Sanitised on save, server-side, against a strict allowlist -- the
        database column is documented as holding sanitised HTML and nothing
        else. The editor that produces it arrives at build step 6; until then
        the only writer is the seed.
      */}
      <div
        className="post-body"
        dangerouslySetInnerHTML={{ __html: post.body }}
      />

      <p>
        <Link href="/weekly">{t("backToWeekly")}</Link>
      </p>
    </article>
  );
}

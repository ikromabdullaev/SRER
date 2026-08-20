import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listArticles } from "@/lib/articles";
import { listPosts } from "@/lib/posts";
import { journal } from "@/config/journal";

/**
 * Homepage, in the order the editors asked for:
 *
 *   1. welcome
 *   2. latest Weekly posts
 *   3. what the journal is and what it accepts
 *   4. recently published papers
 *   5. the call to submit
 *
 * Weekly sits above the scholarly record here because it is the part that
 * changes every week and gives a returning reader a reason to come back;
 * the published record is the part they arrive looking for and can be found
 * from anywhere.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tArticle = await getTranslations("article");
  const tNav = await getTranslations("nav");

  const [posts, articles] = await Promise.all([
    listPosts(locale as Locale, { limit: 3 }),
    listArticles(locale as Locale, { limit: 5 }),
  ]);

  const dateFormat = new Intl.DateTimeFormat(localeHtmlLang[locale as Locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      {/* 1 — Welcome */}
      <section className="home-welcome">
        <h1>{t("welcomeHeading")}</h1>
        <p className="home-welcome__lede">{t("welcomeLede")}</p>
      </section>

      {/* 2 — Latest Weekly */}
      <section>
        <div className="section-head">
          <h2>{t("weeklyHeading")}</h2>
          <Link href="/weekly">{t("seeAllWeekly")}</Link>
        </div>
        {posts.length === 0 ? (
          <p>{t("noPosts")}</p>
        ) : (
          <ul className="article-list">
            {posts.map((post) => (
              <li key={post.id}>
                <Link href={`/weekly/${post.author.handle}/${post.slug}`}>
                  <span lang={localeHtmlLang[post.locale]}>{post.title}</span>
                </Link>
                <div className="article__meta">
                  {post.author.fullName}
                  {post.publishedAt &&
                    ` · ${dateFormat.format(new Date(post.publishedAt))}`}
                  {/*
                    A post exists only in the languages it was written in, so
                    the languages are stated rather than implied. This is the
                    visible half of the rule that a language filter removes a
                    post instead of translating it.
                  */}
                  {" · "}
                  {post.availableLocales.map((l) => l.toUpperCase()).join(" / ")}
                </div>
                {post.excerpt && (
                  <p lang={localeHtmlLang[post.locale]}>{post.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3 — About the journal */}
      <section className="home-about">
        <h2>{t("aboutHeading")}</h2>
        <div className="home-about__identity">
          {/*
            Logo slot. No asset has been supplied yet, so the journal name
            stands in — deliberately, rather than shipping a placeholder image
            that looks like a design decision.
          */}
          <p className="home-about__name">{journal.name}</p>
        </div>
        <p>{t("aboutScope")}</p>
        <p>{t("aboutFocus")}</p>
        <p>
          <Link href="/about">{tNav("about")}</Link>
          {" · "}
          <Link href="/for-authors">{tNav("forAuthors")}</Link>
        </p>
      </section>

      {/* 4 — Recently published */}
      <section>
        <div className="section-head">
          <h2>{t("publishedHeading")}</h2>
          <Link href="/issues">{t("seeAllIssues")}</Link>
        </div>
        {articles.length === 0 ? (
          <p>{t("noArticles")}</p>
        ) : (
          <ul className="article-list">
            {articles.map((article) => (
              <li key={article.id}>
                <Link href={`/articles/${article.slug}`}>
                  <span lang={localeHtmlLang[article.titleLocale]}>
                    {article.title}
                  </span>
                </Link>
                <div className="article__meta">
                  {article.volume !== null && article.number !== null
                    ? tArticle("issueLine", {
                        volume: article.volume,
                        number: article.number,
                        year: article.year ?? "",
                      })
                    : tNav("onlineFirst")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5 — Submit */}
      <section className="home-submit">
        <h2>{t("submitHeading")}</h2>
        <p>{t("submitLede")}</p>
        <p>
          <Link className="button" href="/submit">
            {tNav("submit")}
          </Link>
        </p>
      </section>
    </>
  );
}

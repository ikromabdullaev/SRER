import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listArticles } from "@/lib/articles";
import { listPosts } from "@/lib/posts";
import { journal } from "@/config/journal";
import { Registers } from "@/components/registers";

/**
 * Homepage, in the order the editors asked for: welcome, latest Weekly, what
 * the journal is, recently published, submit.
 *
 * Weekly sits above the record because it is what changes every week and
 * gives a returning reader a reason to come back. The record is what readers
 * arrive looking for and is reachable from anywhere.
 *
 * Everything on this page is a dense list of real facts. A journal with four
 * articles shows four articles properly rather than padding them into cards
 * to look busier than it is.
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

  const date = new Intl.DateTimeFormat(localeHtmlLang[locale as Locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <section className="shell welcome">
        <h1>{t("welcomeHeading")}</h1>
        <p>{t("welcomeLede")}</p>
      </section>

      <div className="shell">
        {/* 2 — This week */}
        <section className="section">
          <div className="section__head">
            <h2>{t("weeklyHeading")}</h2>
            <Link className="section__more" href="/weekly">
              {t("seeAllWeekly")}
            </Link>
          </div>

          {posts.length === 0 ? (
            <p className="empty">{t("noPosts")}</p>
          ) : (
            <ol className="record">
              {posts.map((post, i) => (
                <li key={post.id}>
                  <span className="record__index">
                    {post.publishedAt
                      ? date.format(new Date(post.publishedAt))
                      : String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <Link
                      className="record__title"
                      href={`/weekly/${post.author.handle}/${post.slug}`}
                      lang={localeHtmlLang[post.locale]}
                    >
                      {post.title}
                    </Link>
                    <p className="record__meta">
                      {post.author.fullName}
                      {" · "}
                      <Registers locales={post.availableLocales} />
                    </p>
                    {post.excerpt && (
                      <p
                        className="record__excerpt"
                        lang={localeHtmlLang[post.locale]}
                      >
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 3 — What the journal is */}
        <section className="section">
          <div className="section__head">
            <h2>{t("aboutHeading")}</h2>
            <Link className="section__more" href="/about">
              {tNav("about")}
            </Link>
          </div>

          <div className="about">
            <div>
              {/*
                The identity is the name set as type — a wordmark, no symbol.
                No placeholder image stands in for artwork that does not exist.
              */}
              <p className="about__name">
                Silk Road <span>Economic Review</span>
              </p>
              <p className="record__meta">{journal.publisher}</p>
            </div>
            <div>
              <p>{t("aboutScope")}</p>
              <p>{t("aboutFocus")}</p>
            </div>
          </div>
        </section>

        {/* 4 — Recently published */}
        <section className="section">
          <div className="section__head">
            <h2>{t("publishedHeading")}</h2>
            <Link className="section__more" href="/issues">
              {t("seeAllIssues")}
            </Link>
          </div>

          {articles.length === 0 ? (
            <p className="empty">{t("noArticles")}</p>
          ) : (
            <ol className="record">
              {articles.map((article) => (
                <li key={article.id}>
                  <span className="record__index">
                    {article.volume !== null && article.number !== null
                      ? `${article.volume}(${article.number})`
                      : tNav("onlineFirst")}
                  </span>
                  <div>
                    <Link
                      className="record__title"
                      href={`/articles/${article.slug}`}
                      lang={localeHtmlLang[article.titleLocale]}
                    >
                      {article.title}
                    </Link>
                    <p className="record__meta">
                      {article.firstPage !== null && article.lastPage !== null
                        ? tArticle("pages", {
                            first: article.firstPage,
                            last: article.lastPage,
                          })
                        : article.publishedAt
                          ? date.format(new Date(article.publishedAt))
                          : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* 5 — Submit. A red field, matching the masthead: the journal opens and
          closes with the same commitment. */}
      <section className="submit-band">
        <div className="shell">
          <h2>{t("submitHeading")}</h2>
          <p>{t("submitLede")}</p>
          <p>
            <Link className="button" href="/submit">
              {tNav("submit")}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}

import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listIssues, getIssue, getIssueContents } from "@/lib/issues";

export const dynamicParams = false;

export async function generateStaticParams() {
  const issues = await listIssues(routing.defaultLocale);
  return routing.locales.flatMap((locale) =>
    issues.map((issue) => ({
      locale,
      volume: String(issue.volume),
      number: String(issue.number),
    })),
  );
}

export default async function IssuePage({
  params,
}: {
  params: Promise<{ locale: string; volume: string; number: string }>;
}) {
  const { locale, volume, number } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const issue = await getIssue(Number(volume), Number(number), locale as Locale);
  if (!issue) notFound();

  const t = await getTranslations("issues");
  const tArticle = await getTranslations("article");
  const articles = await getIssueContents(issue.id, locale as Locale);

  return (
    <>
      <h1>{t("issueLine", { volume: issue.volume, number: issue.number })}</h1>
      <p className="article__meta">{issue.year}</p>
      {issue.title && <h2>{issue.title}</h2>}
      {issue.description && <p>{issue.description}</p>}

      <h2>{t("contents")}</h2>
      {articles.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="article-list">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.slug}`}>
                <span lang={localeHtmlLang[article.titleLocale]}>
                  {article.title}
                </span>
              </Link>
              {article.firstPage !== null && article.lastPage !== null && (
                <div className="article__meta">
                  {tArticle("pages", {
                    first: article.firstPage,
                    last: article.lastPage,
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

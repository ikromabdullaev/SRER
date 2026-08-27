import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listIssues } from "@/lib/issues";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function IssuesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("issues");
  const issues = await listIssues(locale as Locale);

  return (
    <div className="shell">
      <header className="page-head">
        <div>
          <h1>{t("title")}</h1>
          <p className="page-head__lede">{t("lede")}</p>
        </div>
      </header>

      {issues.length === 0 ? (
        <p className="empty">{t("none")}</p>
      ) : (
        <ul className="article-list">
          {issues.map((issue) => (
            <li key={issue.id}>
              <Link href={`/issues/${issue.volume}/${issue.number}`}>
                {t("issueLine", { volume: issue.volume, number: issue.number })}
              </Link>
              <div className="article__meta">{issue.year}</div>
              {issue.title && <div>{issue.title}</div>}
              {issue.description && <p>{issue.description}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="page-tail">
        {/* Online-first articles belong to no issue, so they need their own
            entry point or they are reachable only by search. */}
        <Link href="/online-first">{t("onlineFirstTitle")}</Link>
      </p>
    </div>
  );
}

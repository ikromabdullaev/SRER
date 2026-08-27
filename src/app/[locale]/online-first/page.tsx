import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { absoluteUrl, localeAlternates } from "@/config/journal";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listOnlineFirst } from "@/lib/articles";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "issues" });

  return {
    title: t("onlineFirstTitle"),
    description: t("onlineFirstLede"),
    alternates: {
      canonical: absoluteUrl(`/${locale}/online-first`),
      languages: localeAlternates("/online-first", routing.locales, routing.defaultLocale),
    },
  };
}

export default async function OnlineFirstPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("issues");
  const articles = await listOnlineFirst(locale as Locale);

  return (
    <div className="shell">
      <header className="page-head">
        <div>
          <h1>{t("onlineFirstTitle")}</h1>
          <p className="page-head__lede">{t("onlineFirstLede")}</p>
        </div>
      </header>

      {articles.length === 0 ? (
        <p className="empty">{t("none")}</p>
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

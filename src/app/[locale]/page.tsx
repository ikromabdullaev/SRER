import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listArticles } from "@/lib/articles";

/**
 * Placeholder homepage. The real one arrives at build step 4; this exists so
 * locale routing (step 2) is verifiable end to end before the archive is built.
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
  const articles = await listArticles(locale as Locale);

  return (
    <>
      <h1>{t("title")}</h1>
      {articles.length === 0 ? (
        <p>{t("noArticles")}</p>
      ) : (
        <ul className="article-list">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.slug}`}>{article.title}</Link>
              {article.translationMissing && " ·"}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

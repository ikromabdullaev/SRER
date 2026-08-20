import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { listPosts, getEditor } from "@/lib/posts";
import { PostCard } from "@/components/post-card";

/** One editor's Weekly series. */
export default async function EditorSeriesPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const editor = await getEditor(handle);
  if (!editor) notFound();

  const t = await getTranslations("weekly");
  const posts = await listPosts(locale as Locale, { handle });

  return (
    <>
      <h1>{t("seriesTitle", { name: editor.fullName })}</h1>
      {editor.bio && <p>{editor.bio}</p>}

      {posts.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <ul className="article-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              byline={t("byline", { name: post.author.fullName })}
              availableIn={t("availableIn")}
              locale={locale as Locale}
            />
          ))}
        </ul>
      )}

      <p>
        <Link href="/weekly">{t("backToWeekly")}</Link>
      </p>
    </>
  );
}

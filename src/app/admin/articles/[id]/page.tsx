import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import { ArticleEditor } from "@/components/admin/article-editor";
import { DeleteRecord } from "@/components/admin/delete-record";
import { deleteArticle, withdrawArticle } from "../actions";
import type { Locale } from "@/i18n/routing";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  const { id } = await params;
  const supabase = await createAuthClient();

  const { data: article } = await supabase
    .from("articles")
    .select(
      `id, slug, state, primary_language, type, issue_id, position,
       first_page, last_page, jel_codes, pdf_url, pdf_size_bytes,
       received_at, accepted_at,
       article_translations(locale, title, abstract, keywords),
       article_authors(position, is_corresponding,
                       authors(id, family_name, given_name))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!article) notFound();

  const { data: issues } = await supabase
    .from("issues")
    .select("id, volume, number, year")
    .order("volume", { ascending: false })
    .order("number", { ascending: false });

  // Author order is the citation order, so it is restored from `position`
  // rather than whatever order the join happened to return.
  const authors = (article.article_authors ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((link) => ({
      authorId: link.authors.id,
      displayName: `${link.authors.family_name}, ${link.authors.given_name}`,
      isCorresponding: link.is_corresponding,
    }));

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin/articles">Articles</Link>
        <span>{article.state}</span>
      </div>
      <h1>Edit article</h1>
      <ArticleEditor
        issues={(issues ?? []).map((i) => ({
          id: i.id,
          label: `v${i.volume}/n${i.number} (${i.year})`,
        }))}
        initial={{
          id: article.id,
          state: article.state,
          slug: article.slug,
          primaryLanguage: article.primary_language as Locale,
          type: article.type,
          issueId: article.issue_id ?? "",
          position: article.position?.toString() ?? "",
          firstPage: article.first_page?.toString() ?? "",
          lastPage: article.last_page?.toString() ?? "",
          jelCodes: (article.jel_codes ?? []).join(", "),
          pdfUrl: article.pdf_url ?? "",
          pdfSizeBytes: article.pdf_size_bytes?.toString() ?? "",
          receivedAt: article.received_at ?? "",
          acceptedAt: article.accepted_at ?? "",
          translations: (article.article_translations ?? []).map((t) => ({
            locale: t.locale as Locale,
            title: t.title,
            abstract: t.abstract ?? "",
            keywords: (t.keywords ?? []).join(", "),
          })),
          authors,
        }}
      />

      <DeleteRecord
        slug={article.slug}
        isPublic={article.state !== "draft"}
        noun="article"
        returnTo="/admin/articles"
        onDelete={async (confirmSlug) => {
          "use server";
          return deleteArticle(article.id, confirmSlug);
        }}
        onWithdraw={
          article.state === "published"
            ? async () => {
                "use server";
                return withdrawArticle(article.id);
              }
            : undefined
        }
        withdrawLabel="Withdraw this article instead."
        withdrawNote="The record and its metadata are kept and the slug stays locked, so nothing else can ever take that URL and the article can be restored. Note that the page itself currently returns 404 while withdrawn — what a withdrawn article should show is SPEC.md open decision D3, still unresolved."
      />
    </>
  );
}

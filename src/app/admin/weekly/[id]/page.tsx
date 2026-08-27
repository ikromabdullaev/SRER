import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import { PostEditor } from "@/components/admin/post-editor";
import { DeleteRecord } from "@/components/admin/delete-record";
import { deletePost } from "../actions";
import type { Locale } from "@/i18n/routing";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  const { id } = await params;
  const supabase = await createAuthClient();

  // RLS decides visibility: an editor reading someone else's draft simply
  // gets nothing back, which is a 404 here rather than a special case.
  const { data: post } = await supabase
    .from("posts")
    .select("id, slug, state, post_translations(locale, title, excerpt, body)")
    .eq("id", id)
    .maybeSingle();

  if (!post) notFound();

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin/weekly">← Weekly</Link>
        <span>{post.state}</span>
      </div>
      <h1>Edit Weekly post</h1>
      <PostEditor
        initial={{
          id: post.id,
          slug: post.slug,
          translations: (post.post_translations ?? []).map((t) => ({
            locale: t.locale as Locale,
            title: t.title,
            excerpt: t.excerpt ?? "",
            body: t.body,
          })),
        }}
      />

      <DeleteRecord
        slug={post.slug}
        isPublic={post.state !== "draft"}
        noun="post"
        returnTo="/admin/weekly"
        onDelete={async (confirmSlug) => {
          "use server";
          return deletePost(post.id, confirmSlug);
        }}
      />
    </>
  );
}

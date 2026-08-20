import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import { ArticleEditor } from "@/components/admin/article-editor";

export default async function NewArticlePage() {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createAuthClient();
  const { data: issues } = await supabase
    .from("issues")
    .select("id, volume, number, year")
    .order("volume", { ascending: false })
    .order("number", { ascending: false });

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin/articles">Articles</Link>
        <span>{profile.fullName}</span>
      </div>
      <h1>New article</h1>
      <ArticleEditor
        issues={(issues ?? []).map((i) => ({
          id: i.id,
          label: `v${i.volume}/n${i.number} (${i.year})`,
        }))}
      />
    </>
  );
}

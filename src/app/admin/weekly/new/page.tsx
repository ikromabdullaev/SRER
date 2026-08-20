import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffProfile } from "@/lib/supabase/auth";
import { PostEditor } from "@/components/admin/post-editor";

export default async function NewPostPage() {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin/weekly">← Weekly</Link>
        <span>{profile.fullName}</span>
      </div>
      <h1>New Weekly post</h1>
      <PostEditor />
    </>
  );
}

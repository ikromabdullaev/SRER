import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffProfile } from "@/lib/supabase/auth";

/** Placeholder. The real surface lands with the rest of build step 6. */
export default async function Page() {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin">← Admin</Link>
        <span>{profile.fullName}</span>
      </div>
      <h1>Articles</h1>
      <p className="article__meta">Not built yet.</p>
    </>
  );
}

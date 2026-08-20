import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffProfile } from "@/lib/supabase/auth";
import { SignOutButton } from "@/components/admin/sign-out-button";

export default async function AdminHome() {
  // The proxy already bounced anonymous requests. This is the second check:
  // middleware protects the page, not the data behind it, and every admin
  // surface re-establishes who is calling.
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  return (
    <>
      <div className="admin-bar">
        <span>
          {profile.fullName} · {profile.role}
        </span>
        <SignOutButton />
      </div>

      <h1>Admin</h1>
      <ul>
        <li>
          <Link href="/admin/articles">Articles</Link>
        </li>
        <li>
          <Link href="/admin/weekly">Weekly</Link>
        </li>
        <li>
          <Link href="/admin/proposals">Proposals</Link>
        </li>
      </ul>
    </>
  );
}

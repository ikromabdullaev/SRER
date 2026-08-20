import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";

/** An editor sees their own series; an admin sees everyone's. */
export default async function WeeklyAdminPage() {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createAuthClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, state, published_at, author_id, post_translations(locale, title)")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin">← Admin</Link>
        <span>{profile.fullName}</span>
      </div>

      <h1>Weekly</h1>

      {!profile.handle && (
        <p className="admin-error">
          Your account has no handle yet, so your posts have no public URL. An
          admin sets it on your profile.
        </p>
      )}

      <p>
        <Link href="/admin/weekly/new">Write a new post</Link>
      </p>

      {!posts || posts.length === 0 ? (
        <p className="article__meta">Nothing written yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Languages</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const translations = post.post_translations ?? [];
              const primary =
                translations.find((t) => t.locale === "en") ?? translations[0];
              return (
                <tr key={post.id}>
                  <td>
                    <Link href={`/admin/weekly/${post.id}`}>
                      {primary?.title ?? "(untitled)"}
                    </Link>
                  </td>
                  <td>
                    {translations.length === 0
                      ? "—"
                      : translations
                          .map((t) => t.locale.toUpperCase())
                          .sort()
                          .join(" / ")}
                  </td>
                  <td>{post.state}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

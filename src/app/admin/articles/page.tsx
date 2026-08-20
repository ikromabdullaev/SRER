import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";

export default async function ArticlesAdminPage() {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createAuthClient();
  const { data: articles } = await supabase
    .from("articles")
    .select(
      "id, slug, state, primary_language, article_translations(locale, title)",
    )
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin">Admin</Link>
        <span>{profile.fullName}</span>
      </div>

      <h1>Articles</h1>
      <p>
        <Link href="/admin/articles/new">Add an article</Link>
      </p>

      {!articles || articles.length === 0 ? (
        <p className="article__meta">Nothing yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Translations</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const translations = article.article_translations ?? [];
              const primary =
                translations.find(
                  (t) => t.locale === article.primary_language,
                ) ?? translations[0];
              const complete = translations.length === 3;

              return (
                <tr key={article.id}>
                  <td>
                    <Link href={`/admin/articles/${article.id}`}>
                      {primary?.title ?? "(untitled)"}
                    </Link>
                  </td>
                  <td>
                    {translations
                      .map((t) => t.locale.toUpperCase())
                      .sort()
                      .join(" / ") || "none"}
                    {/* Information, never a blocker: publishing with a single
                        locale filled is expected (SPEC.md §7.1). */}
                    {!complete && <span className="badge">incomplete</span>}
                  </td>
                  <td>{article.state}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

-- Repair the privileges on a project where the initial migration was applied
-- before it carried the revoke.
--
-- A hosted Supabase project bootstraps
--   alter default privileges in schema public grant all on tables
--     to anon, authenticated
-- so every table the initial migration created arrived with a TABLE-level
-- grant for anon. A table-level SELECT covers every column, which silently
-- defeated the column-scoped grants below: on the hosted project, anon could
-- read `authors.email`, and would have been able to read `profiles.role`.
-- Locally there is no such default, so neither the local stack nor the
-- verification harness could see it. Found by querying the real project.
--
-- The initial migration now carries this same revoke, so a fresh deployment
-- never needs this file. It exists for projects already provisioned. Running
-- it twice is harmless: it revokes, then re-grants exactly what is intended.

-- Start from nothing. A hosted Supabase project has already granted anon and
-- authenticated ALL on every table in this schema via default privileges, and
-- a table-level grant covers every column -- which would publish
-- `authors.email` and `profiles.role` regardless of the column lists below.
-- This is a no-op on a local stack and load-bearing in production.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Public read. Row visibility is still decided by the policies above: these
-- tables are readable, not their draft rows.
grant select on articles             to anon, authenticated;
grant select on article_translations to anon, authenticated;
grant select on issues               to anon, authenticated;
grant select on issue_translations   to anon, authenticated;
grant select on article_authors      to anon, authenticated;
grant select on author_translations  to anon, authenticated;

grant select on posts             to anon, authenticated;
grant select on post_translations to anon, authenticated;

-- authors is column-restricted: everything except `email`.
grant select (id, slug, family_name, given_name, orcid, website_url, created_at)
  on authors to anon, authenticated;

-- profiles is column-restricted for the Weekly byline. `role` is withheld
-- from anon: which accounts are admins is not public information.
grant select (id, handle, full_name, bio) on profiles to anon;

-- `authenticated` additionally reads `role`, and must. The "staff read
-- profiles" policy above exists precisely so a signed-in editor can read
-- their own row, and every admin surface calls getStaffProfile() to decide
-- what that person may do. Granting the rows without the column denies the
-- whole statement with 42501, and the admin shell then treats a perfectly
-- valid session as "not staff" -- which the proxy answers by redirecting to
-- the login page, which redirects back: ERR_TOO_MANY_REDIRECTS.
-- Rows are still gated by the policies; anon remains blind to `role`.
grant select (id, handle, full_name, bio, role) on profiles to authenticated;

grant insert, update, delete on
  articles, article_translations, article_authors,
  authors, author_translations,
  issues, issue_translations,
  posts, post_translations
  to authenticated;

-- Staff read drafts through their own session, so they need select on the
-- tables the public cannot see rows in.
grant select on proposals to authenticated;
grant insert, update on proposals to authenticated;

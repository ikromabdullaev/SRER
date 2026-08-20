# Schema verification harness

Applies the SQL in `../SCHEMA.md` **verbatim** to a throwaway Postgres 16 and
asserts the behaviour the spec promises. Run it after any change to `SCHEMA.md`,
and again as the acceptance test for build step 1.

```bash
docker run -d --name srer-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=journal postgres:16
bash run.sh
```

`run.sh` resets the database each time, so it is safe to re-run. Cleanup:
`docker rm -f srer-pg`.

## What each file is

| File | Role |
|---|---|
| `extract.py` | Pulls every ```sql fence out of `../SCHEMA.md`, in order, into `schema.sql`. The doc is the source — nothing here duplicates it. |
| `prelude.sql` | Stands in for what Supabase provisions: the `anon`/`authenticated`/`service_role` roles, the `auth` schema, `auth.users`, `auth.uid()`, and the default grants. Not part of the project schema. |
| `seed.sql` | The seed set from `SCHEMA.md` → *Seed data*, with fixed UUIDs so tests can reference rows. |
| `tests.sql` | 26 assertions. Prints a PASS/FAIL table and raises if any row fails. |
| `schema.sql` | **Generated** by `extract.py` on every run. Never edit it; edit `../SCHEMA.md`. |

## What is covered

- **RLS:** the draft article is invisible to `anon` through the tables *and*
  through `published_articles_localised`; draft author links and translations
  are hidden; proposals are unreadable and uninsertable by `anon`.
- **Fallback:** the uz-only article renders for a `ru` request; a half-filled
  `ru` row keeps its own title but takes its abstract from `en`; an empty
  keywords array falls through instead of terminating the chain.
- **Online-first:** an article with no issue appears in all three locales with a
  null volume.
- **Generated column:** `search_vector` is populated; `uz` does not stem
  (`iqtisodiyot` does not match `iqtisodiyotning`) while `en` does.
- **Triggers:** slug, DOI, and PDF URL are immutable once published, and
  withdrawing does not unlock them; a page-range correction is still allowed;
  `updated_at` is touched; author positions can be swapped in one transaction.

## Not covered here

The primary-translation guard and the column-level `authors.email` grant are
verified by hand (see the session notes) because both are expect-failure cases
that abort a transaction:

```bash
# must fail at COMMIT with "has no en title"
docker exec srer-pg psql -U postgres -d journal -c \
  "begin; insert into articles (slug, primary_language, pdf_url, state, published_at) \
   values ('x','en','https://x/y.pdf','published',now()); commit;"

# must fail with "permission denied for table authors"
docker exec srer-pg psql -U postgres -d journal -c "set role anon; select * from authors;"
```

Fold both into the real Vitest suite at step 0/1, where an expected rejection is
an ordinary assertion rather than an aborted script.

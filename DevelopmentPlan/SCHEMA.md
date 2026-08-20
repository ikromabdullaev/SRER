# SCHEMA.md — Database

> Postgres via Supabase. This file is the source of truth for the data model.
> Change it deliberately; regenerate TypeScript types after every migration.
>
> Companion to `SPEC.md`, which governs scope and behaviour.

---

## Open decisions

One unresolved question in `SPEC.md` under **Open decisions** still changes this
file when answered: **D3** (whether a withdrawn article is a tombstone, which
changes the RLS predicate from `state = 'published'` to
`state in ('published', 'withdrawn')`).
Everything else below is settled. DOIs are out of scope for now, so `doi`
stays nullable with no constraint requiring it.

---

## Design principles

1. **`proposals` and `articles` are different things.** A proposal is an inbound
   enquiry. An article is a published record. A proposal does not become an
   article through a status flag — an editor reads it, contacts the author
   offline, and eventually creates an article. Keeping them separate keeps every
   public query trivially safe.

2. **Translations live in their own tables, not JSONB columns.** JSONB looks
   tidy for a week, then you can't index it for full-text search or answer "which
   articles are missing a Russian abstract?" without pain.

3. **Authors are entities, not strings.** Never store an author list as text.
   Author names need per-locale forms (`Karimov` / `Каримов`), and author pages
   require a stable identity across issues.

4. **Unused tables are cheap; wrong relationships are expensive.** `reviews` and
   `editorial_decisions` are defined here and unused in v1. Getting the shape
   right now costs nothing.

---

## Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;      -- Uzbek trigram search
create extension if not exists unaccent;
```

## Immutable helpers

`array_to_string()` is **STABLE, not IMMUTABLE** — array element output
functions are not guaranteed immutable — so it cannot appear in a generated
column or an index expression. Postgres rejects the table outright with
*"generation expression is not immutable"*. Wrap it:

```sql
create or replace function immutable_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe as $$
  select array_to_string(arr, sep);
$$;
```

`unaccent()` is STABLE for the same class of reason (it resolves a dictionary by
name at call time). If accent-insensitive matching is wanted in the trigram
indexes, pin the dictionary and wrap it the same way — see open decision **D8**:

```sql
create or replace function immutable_unaccent(t text)
returns text language sql immutable parallel safe as $$
  select unaccent('unaccent'::regdictionary, t);
$$;
```

## Enums

```sql
create type locale_code   as enum ('en', 'uz', 'ru');
create type article_type  as enum (
  'research_article', 'review_article', 'case_study',
  'policy_note', 'book_review', 'editorial', 'correction', 'retraction'
);
create type publish_state as enum ('draft', 'published', 'withdrawn');
create type proposal_state as enum ('new', 'contacted', 'accepted', 'declined', 'spam');
create type user_role     as enum ('admin', 'editor');
create type review_recommendation as enum (
  'accept', 'minor_revision', 'major_revision', 'reject'
);
```

> `locale_code` is an enum on purpose. Adding a fourth language should be a
> deliberate migration, not an accident.

---

## Core tables

### `profiles`

Admin and editor accounts. Keyed to Supabase `auth.users`.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  handle      text unique,           -- URL-safe; used by /weekly/{handle}
  bio         text,
  role        user_role not null default 'editor',
  created_at  timestamptz not null default now(),

  constraint handle_format
    check (handle is null or handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
```

`handle` is public and appears in Weekly URLs, so it is subject to the usual
permanence pressure: changing it breaks every link to that editor's posts. It
is nullable because only editors who publish a Weekly series need one.

**`role` is not public.** Which accounts are admins is not information the
site should hand out, so the public grant covers `id`, `handle`, `full_name`,
and `bio` only — the same column-grant technique that withholds
`authors.email`. See Grants.

### `issues`

```sql
create table issues (
  id                uuid primary key default uuid_generate_v4(),
  volume            int not null,
  number            int not null,
  year              int not null,
  published_at      timestamptz,
  state             publish_state not null default 'draft',
  cover_image_url   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (volume, number)
);

create table issue_translations (
  issue_id    uuid not null references issues(id) on delete cascade,
  locale      locale_code not null,
  title       text,          -- optional: special-issue titles
  description text,
  primary key (issue_id, locale)
);
```

### `articles`

```sql
create table articles (
  id                uuid primary key default uuid_generate_v4(),
  slug              text not null unique,
  doi               text unique,
  issue_id          uuid references issues(id) on delete set null,  -- null = online first
  position          int,                     -- order within the issue TOC
  primary_language  locale_code not null,    -- language of the PDF full text
  type              article_type not null default 'research_article',
  pdf_url           text,                    -- permanent, public, unsigned
  pdf_size_bytes    bigint,
  first_page        int,
  last_page         int,
  jel_codes         text[] not null default '{}',
  license           text not null default 'CC BY 4.0',
  state             publish_state not null default 'draft',
  published_at      timestamptz,
  received_at       date,                    -- for the "Received / Accepted" line
  accepted_at       date,
  supersedes_id     uuid references articles(id),  -- corrections / retractions
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint published_needs_date
    check (state <> 'published' or published_at is not null),
  constraint published_needs_pdf
    check (state <> 'published' or pdf_url is not null),
  constraint sane_pages
    check (last_page is null or first_page is null or last_page >= first_page)
);
```

**`slug`, `doi`, and `pdf_url` are immutable after publication.** All three are
permanence-constrained by `SPEC.md` §5.7 — `citation_pdf_url` and the DOI
resource URL must never change. Enforce in application code and with the
`guard_permanent_identifiers` trigger below.

**A published article must carry a title.** Nothing in this table can express
that, because titles live in `article_translations`; the constraint trigger
below does it. Without it a published article can have zero translation rows,
the localised view returns `title = NULL`, and `citation_title` — the one tag
the entire project exists to emit — goes out empty.

**DOIs are out of scope at this stage** (`SPEC.md` §2). `doi` stays nullable and
nothing populates it. The column and its guard are kept because they cost
nothing and make adoption later a plain `UPDATE`: the trigger locks a DOI only
once assigned (`old.doi is not null`), so a published article can receive one
afterwards but never have it changed. Verified against a live database.

### `article_translations`

```sql
create table article_translations (
  article_id    uuid not null references articles(id) on delete cascade,
  locale        locale_code not null,
  title         text not null,
  abstract      text,
  keywords      text[] not null default '{}',

  search_vector tsvector generated always as (
    setweight(
      to_tsvector(
        case locale
          when 'en' then 'english'::regconfig
          when 'ru' then 'russian'::regconfig
          else 'simple'::regconfig
        end,
        coalesce(title, '')
      ), 'A')
    ||
    setweight(
      to_tsvector(
        case locale
          when 'en' then 'english'::regconfig
          when 'ru' then 'russian'::regconfig
          else 'simple'::regconfig
        end,
        coalesce(abstract, '')
      ), 'B')
    ||
    setweight(
      to_tsvector(
        case locale
          when 'en' then 'english'::regconfig
          when 'ru' then 'russian'::regconfig
          else 'simple'::regconfig
        end,
        immutable_array_to_string(keywords, ' ')
      ), 'A')
  ) stored,

  primary key (article_id, locale)
);
```

> The `::regconfig` casts matter. `to_tsvector(text, text)` is only STABLE and
> will be rejected in a generated column; `to_tsvector(regconfig, text)` is
> IMMUTABLE and works. `immutable_array_to_string` is the same trap one level
> down — see **Immutable helpers** above. Verify the whole expression compiles
> against a scratch database before building anything on top of it.

> `uz` uses the `simple` config because Postgres ships no Uzbek dictionary. That
> means no stemming — `iqtisodiyot` will not match `iqtisodiyotning`. The
> trigram indexes below compensate. This is a morphology limitation, unrelated to
> the Latin-script decision.

### `authors`

```sql
create table authors (
  id            uuid primary key default uuid_generate_v4(),
  slug          text not null unique,   -- URL-safe; /authors/{slug}
  family_name   text not null,     -- Latin, canonical
  given_name    text not null,     -- Latin, canonical
  orcid         text unique,
  email         text,
  website_url   text,
  created_at    timestamptz not null default now(),

  constraint orcid_format
    check (orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'),
  constraint author_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table author_translations (
  author_id     uuid not null references authors(id) on delete cascade,
  locale        locale_code not null,
  display_name  text not null,   -- 'Karimov, Aziz' / 'Каримов, Азиз'
  affiliation   text,
  primary key (author_id, locale)
);

create table article_authors (
  article_id      uuid not null references articles(id) on delete cascade,
  author_id       uuid not null references authors(id) on delete restrict,
  position        int not null,          -- 1-based author order
  is_corresponding boolean not null default false,
  primary key (article_id, author_id),
  constraint article_authors_position_unique
    unique (article_id, position) deferrable initially deferred
);
```

The position constraint is **deferrable** on purpose. The reorderable author
repeater in `SPEC.md` §7.1 swaps two positions in one transaction, which
transiently duplicates a value; a non-deferrable unique constraint rejects that
and forces a temp-value dance in application code.

`authors.family_name` and `given_name` are the **Latin canonical** forms used for
`citation_author` meta tags and Crossref deposits. Localised display forms live
in `author_translations`.

`slug` is derived from the Latin form (`karimov-aziz`) and is what `/authors/`
routes on. Author pages get indexed, so treat it with the same permanence
discipline as an article slug: generate it once, then leave it alone. It is the
resolution of open decision **D6** -- a UUID in a public URL is a URL you cannot
make legible later.

### `proposals`

```sql
create table proposals (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text not null,
  affiliation   text,
  title         text not null,
  abstract      text not null,
  locale        locale_code not null,    -- intended publication language
  file_url      text,                    -- PRIVATE bucket
  coauthor_note text,
  state         proposal_state not null default 'new',
  admin_notes   text,
  source_ip     inet,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### `posts`

The Weekly series (see `SPEC.md` → **Weekly**). A separate content type from
`articles`: no PDF, no issue, no DOI, and never mixed into the scholarly record.

```sql
create table posts (
  id            uuid primary key default uuid_generate_v4(),
  author_id     uuid not null references profiles(id) on delete restrict,
  slug          text not null,
  state         publish_state not null default 'draft',
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- The URL is /weekly/{handle}/{slug}, so slugs need only be unique per
  -- editor. Two editors may each write a "market-review-2026".
  unique (author_id, slug),

  constraint published_needs_date
    check (state <> 'published' or published_at is not null)
);
```

Note what is **absent**: no `pdf_url`, no `issue_id`, no `doi`, no
`primary_language`. A post has no single original language in the way an
article's PDF does — it exists in whichever languages were written, and none of
them is the record.

### `post_translations`

```sql
create table post_translations (
  post_id       uuid not null references posts(id) on delete cascade,
  locale        locale_code not null,
  title         text not null,
  excerpt       text,
  -- Sanitised HTML, produced by the admin editor and cleaned server-side
  -- against a strict allowlist. Never render un-sanitised input here.
  body          text not null,

  search_vector tsvector generated always as (
    setweight(
      to_tsvector(
        case locale
          when 'en' then 'english'::regconfig
          when 'ru' then 'russian'::regconfig
          else 'simple'::regconfig
        end,
        coalesce(title, '')
      ), 'A')
    ||
    setweight(
      to_tsvector(
        case locale
          when 'en' then 'english'::regconfig
          when 'ru' then 'russian'::regconfig
          else 'simple'::regconfig
        end,
        coalesce(excerpt, '')
      ), 'B')
    ||
    setweight(
      to_tsvector(
        case locale
          when 'en' then 'english'::regconfig
          when 'ru' then 'russian'::regconfig
          else 'simple'::regconfig
        end,
        coalesce(body, '')
      ), 'C')
  ) stored,

  primary key (post_id, locale)
);
```

The existence of a row here is what makes a post available in that locale.
There is **no fallback**: unlike `article_translations`, a missing row means the
post does not exist in that language, which is exactly what `SPEC.md` →
**Weekly** → *Languages* specifies. The body is indexed at weight `C` so a
matching title still outranks a passing mention in a long piece.

---

## Defined but unused in v1

Create these. Do not build features against them.

```sql
create table reviews (
  id              uuid primary key default uuid_generate_v4(),
  article_id      uuid not null references articles(id) on delete cascade,
  reviewer_id     uuid references profiles(id),
  round           int not null default 1,
  recommendation  review_recommendation,
  comments_to_author text,
  comments_to_editor text,
  due_at          timestamptz,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table editorial_decisions (
  id            uuid primary key default uuid_generate_v4(),
  article_id    uuid not null references articles(id) on delete cascade,
  editor_id     uuid references profiles(id),
  round         int not null default 1,
  decision      review_recommendation not null,
  note          text,
  decided_at    timestamptz not null default now()
);
```

---

## Indexes

```sql
-- Full-text, per locale
create index article_translations_fts_idx
  on article_translations using gin (search_vector);

-- Trigram fallback, matters most for Uzbek (no stemmer)
create index article_translations_title_trgm_idx
  on article_translations using gin (title gin_trgm_ops);
create index article_translations_abstract_trgm_idx
  on article_translations using gin (abstract gin_trgm_ops);

-- Author name search
create index author_translations_name_trgm_idx
  on author_translations using gin (display_name gin_trgm_ops);
create index authors_family_trgm_idx
  on authors using gin (family_name gin_trgm_ops);

-- Common access paths
create index articles_published_idx
  on articles (published_at desc) where state = 'published';
create index articles_issue_idx  on articles (issue_id, position);
create index articles_type_idx   on articles (type) where state = 'published';
create index articles_jel_idx    on articles using gin (jel_codes);
create index article_authors_author_idx on article_authors (author_id);
create index proposals_state_idx on proposals (state, created_at desc);

-- "Which articles are missing a Russian abstract?" — the (article_id, locale)
-- primary key cannot serve a locale-first scan.
create index article_translations_locale_idx
  on article_translations (locale);

-- Weekly
create index posts_published_idx
  on posts (published_at desc) where state = 'published';
create index posts_author_idx on posts (author_id, published_at desc);
create index post_translations_fts_idx
  on post_translations using gin (search_vector);
create index post_translations_title_trgm_idx
  on post_translations using gin (title gin_trgm_ops);
create index post_translations_locale_idx
  on post_translations (locale);
```

---

## Row Level Security

Enable RLS on **every** table. Public read is an explicit policy.

```sql
alter table articles              enable row level security;
alter table article_translations  enable row level security;
alter table issues                enable row level security;
alter table issue_translations    enable row level security;
alter table authors               enable row level security;
alter table author_translations   enable row level security;
alter table article_authors       enable row level security;
alter table proposals             enable row level security;
alter table profiles              enable row level security;
alter table reviews               enable row level security;
alter table editorial_decisions   enable row level security;
alter table posts                 enable row level security;
alter table post_translations     enable row level security;

-- Helpers. A `security definer` function must pin its search_path, or a caller
-- can shadow `profiles` with a temp table and promote themselves to staff.
create or replace function is_staff() returns boolean
language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Public sees published articles only
create policy "public reads published articles"
  on articles for select
  using (state = 'published');

create policy "public reads translations of published articles"
  on article_translations for select
  using (exists (
    select 1 from articles a
    where a.id = article_id and a.state = 'published'
  ));

create policy "public reads published issues"
  on issues for select using (state = 'published');

-- Authors and their translations are public (needed for author pages).
create policy "public reads authors" on authors for select using (true);
create policy "public reads author translations"
  on author_translations for select using (true);

-- RLS cannot hide a *column*, and `authors.email` is editorial contact data: a
-- table-wide select grant publishes a harvestable list of academic emails
-- through PostgREST. See the Grants section below, which withholds it.

-- Consequence: `select *` on authors fails for anon with "permission denied
-- for table authors". Public queries must name the columns — in supabase-js,
-- .select('id, family_name, given_name'), never .select('*').

-- Article-author links are public only for published articles. `using (true)`
-- here would let anon enumerate the ids of unpublished drafts.
create policy "public reads article authors of published articles"
  on article_authors for select
  using (exists (
    select 1 from articles a
    where a.id = article_id and a.state = 'published'
  ));

-- Staff full access to the content tables. Spelled out rather than left as
-- "repeat for every table": a table quietly missing its policy is a table the
-- admin UI cannot write, and the failure surfaces as a confusing empty result
-- rather than an error.
create policy "staff manage articles" on articles
  for all using (is_staff()) with check (is_staff());
create policy "staff manage article translations" on article_translations
  for all using (is_staff()) with check (is_staff());
create policy "staff manage article authors" on article_authors
  for all using (is_staff()) with check (is_staff());
create policy "staff manage authors" on authors
  for all using (is_staff()) with check (is_staff());
create policy "staff manage author translations" on author_translations
  for all using (is_staff()) with check (is_staff());
create policy "staff manage issues" on issues
  for all using (is_staff()) with check (is_staff());
create policy "staff manage issue translations" on issue_translations
  for all using (is_staff()) with check (is_staff());

-- Profiles. There is no public signup: staff accounts are provisioned by
-- inviting the user in the Supabase dashboard, which creates the `auth.users`
-- row; the trigger below mirrors it into `profiles` as an `editor`. Role
-- changes are user management, which SPEC.md §7.4 reserves to `admin` — the
-- only place that distinction is enforceable is here, not in the UI.
-- A profile becomes publicly visible by being given a handle: that is what
-- opting into a public Weekly series means. Only the byline columns are
-- readable (see Grants) -- the grant limits WHICH COLUMNS, this policy limits
-- WHICH ROWS, and both are required. With the grant alone, anon reads zero
-- rows; with the policy alone, anon cannot reach the table at all.
create policy "public reads editor bylines" on profiles
  for select using (handle is not null);

create policy "staff read profiles" on profiles
  for select using (is_staff());
create policy "admins manage profiles" on profiles
  for all using (is_admin()) with check (is_admin());

-- Weekly posts: public reads published ones, same shape as articles.
create policy "public reads published posts"
  on posts for select
  using (state = 'published');

create policy "public reads translations of published posts"
  on post_translations for select
  using (exists (
    select 1 from posts p
    where p.id = post_id and p.state = 'published'
  ));

-- An editor manages their own posts; an admin manages anyone's.
create policy "editors manage their own posts"
  on posts for all
  using (is_staff() and (author_id = auth.uid() or is_admin()))
  with check (is_staff() and (author_id = auth.uid() or is_admin()));

create policy "editors manage their own post translations"
  on post_translations for all
  using (exists (
    select 1 from posts p
    where p.id = post_id and is_staff()
      and (p.author_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from posts p
    where p.id = post_id and is_staff()
      and (p.author_id = auth.uid() or is_admin())
  ));

-- Proposals: written server-side only, staff read.
--
-- There is deliberately NO anon insert policy. `insert with check (true)` lets
-- anyone set `state`, `admin_notes`, and `source_ip` to whatever they like,
-- which makes `source_ip` worthless for the rate limit SPEC.md §8 requires. The
-- public form posts to a Route Handler that inserts with the service-role key,
-- so the server owns the IP and the initial state. The private proposals
-- bucket already forces a server-side step, so this costs nothing.
create policy "staff read proposals"
  on proposals for select using (is_staff());
create policy "staff update proposals"
  on proposals for update using (is_staff());
```

Draft articles must be invisible to the anon key. Verify this explicitly with a
test — it is the single most likely security mistake in this project.

**RLS does not protect a view by default.** A view executes with its *owner's*
privileges, and views in `public` are owned by a privileged role and exposed
through PostgREST — so a plain view over `articles` bypasses every policy above.
Every view here must be declared `with (security_invoker = true)` (Postgres 15+),
and the RLS test must query the **views** with the anon key, not only the
tables.

---

## Grants

**RLS is only half of access control, and the half that fails loudly is the
other one.** A policy decides which *rows* a role may see; a `GRANT` decides
whether the role may touch the table at all. A table with perfect policies and
no grant returns `permission denied for table articles` through PostgREST — not
an empty array.

Supabase does **not** grant anything on new tables implicitly. Verified against
a local stack: with the policies below in place and no grants, every anon
request to `/rest/v1/articles` returned 42501, and only `authors` worked,
because it is the one table this file grants explicitly. Do not rely on ambient
default privileges; state the grants.

```sql
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

-- profiles is column-restricted for the Weekly byline. `role` is withheld:
-- which accounts are admins is not public information.
grant select (id, handle, full_name, bio) on profiles to anon, authenticated;
```

The localised view carries its own grant, in the Views section below — it cannot
be granted here because it does not exist yet at this point in the migration.
Being `security_invoker`, it also needs the grants above on the tables it reads,
which is why both are required.

Beyond the byline columns above, nothing is granted to `anon` on `profiles`,
and nothing at all on `proposals`, `reviews`, or `editorial_decisions`. Proposals are written server-side with the service-role
key (§8 of `SPEC.md`), and the anon insert is denied at the grant level before
RLS is even consulted.

Write grants for `authenticated`. Every row is still gated by the staff
policies above -- there is no public signup, so an authenticated session is a
staff session, but the policy is what enforces that rather than the assumption.

```sql
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
```

Deliberately absent: any grant that lets `authenticated` write `profiles`
beyond what the admin policy allows, and any `delete` on `proposals` -- an
enquiry that has been answered is filed, not erased.

## Storage buckets

| Bucket | Access | Contents |
|---|---|---|
| `articles` | **Public** | Published PDFs. Permanent paths, no signed URLs. |
| `covers` | Public | Issue cover images. |
| `proposals` | **Private** | Uploaded proposal files. Signed URLs for staff only. |
| `post-images` | Public | Images embedded in Weekly posts. |

The sanitiser allows `<img>` only with a `src` inside `post-images`, so a
sanitised post cannot hotlink to a third party or carry a tracking beacon.

Buckets and their policies are created by the migration rather than clicked
into existence in a dashboard, so a fresh environment comes up identical to
production.

```sql
insert into storage.buckets (id, name, public)
values
  ('articles',    'articles',    true),
  ('covers',      'covers',      true),
  ('post-images', 'post-images', true),
  ('proposals',   'proposals',   false)
on conflict (id) do nothing;

-- Public buckets are readable by anyone. This is the point: citation_pdf_url
-- must be a direct, permanent, unauthenticated link (SPEC.md 5.1), and a
-- signed URL would expire and break Google Scholar.
create policy "public reads public buckets"
  on storage.objects for select
  using (bucket_id in ('articles', 'covers', 'post-images'));

-- Staff write the public buckets.
create policy "staff write public buckets"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('articles', 'covers', 'post-images') and is_staff());

create policy "staff update public buckets"
  on storage.objects for update to authenticated
  using (bucket_id in ('articles', 'covers', 'post-images') and is_staff());

-- Proposal uploads are private: readable by staff only, and written by the
-- server on behalf of an anonymous submitter through a signed upload URL
-- (SPEC.md 8). There is no anon policy here at all.
create policy "staff read proposal files"
  on storage.objects for select to authenticated
  using (bucket_id = 'proposals' and is_staff());
```

Deleting published objects is deliberately not granted to anyone: a PDF that
disappears breaks `citation_pdf_url` permanently, and removing one should be a
considered act performed with the service-role key, not a click.

Paths below are **within** the bucket — the first segment is a folder in the
`articles` bucket, not the bucket name repeated. The resulting public URL is
`{SUPABASE_URL}/storage/v1/object/public/articles/v1/n1/{slug}.pdf`.

PDF path convention: `v{volume}/n{number}/{slug}.pdf`. For online-first
articles: `online-first/{slug}.pdf` — and **do not move it** when the article is
later assigned to an issue. `citation_pdf_url` must never change, and the
`guard_permanent_identifiers` trigger enforces that.

The `proposals` bucket is private, so anonymous submitters cannot upload to it
directly and a 20 MB file cannot pass through a Vercel function body. The
upload goes through a signed upload URL minted server-side — see `SPEC.md` §8.

---

## Views

Implements the **full** fallback chain from `SPEC.md` §4.3 — requested locale →
`primary_language` → `en` → any available — and does it **per field**, not per
row. Field-level matters because a half-filled translation row is the normal
case: `SPEC.md` §7.1 lets an editor save a tab with a title and no abstract, and
a row-level `coalesce` would then return that row's empty abstract instead of
falling through. `keywords` needs the cardinality test for the same reason — it
is `not null default '{}'`, so an empty array is not NULL and defeats `coalesce`.

```sql
-- Fallback priority for one candidate locale. Immutable so it can be used in
-- an ORDER BY without blocking inlining.
create or replace function locale_rank(
  candidate locale_code, requested locale_code, primary_lang locale_code
) returns int language sql immutable parallel safe as $$
  select case candidate
           when requested    then 1
           when primary_lang then 2
           when 'en'         then 3
           else 4
         end;
$$;

-- Everything an article page needs, one row per article per locale, with the
-- locale fallback chain already resolved. security_invoker is mandatory: see
-- the note under Row Level Security.
--
-- One lateral per field, not one per row: each picks the best-ranked
-- translation that actually has a value for that field, so a half-filled row
-- contributes its title without also contributing its empty abstract.
create view published_articles_localised
with (security_invoker = true) as
select
  a.id, a.slug, a.doi, a.issue_id, a.position,
  a.primary_language, a.type, a.pdf_url, a.pdf_size_bytes,
  a.first_page, a.last_page, a.published_at, a.jel_codes, a.license,
  i.volume, i.number, i.year,
  l.locale as requested_locale,
  ft.title,                          ft.locale as title_locale,
  fa.abstract,                       fa.locale as abstract_locale,
  coalesce(fk.keywords, '{}'::text[]) as keywords,
                                     fk.locale as keywords_locale,
  (req.article_id is null)           as translation_missing
from articles a
cross join unnest(enum_range(null::locale_code)) as l(locale)
left join issues i on i.id = a.issue_id
left join article_translations req
  on req.article_id = a.id and req.locale = l.locale
left join lateral (
  select t.title, t.locale
  from article_translations t
  where t.article_id = a.id and t.title is not null
  order by locale_rank(t.locale, l.locale, a.primary_language)
  limit 1
) ft on true
left join lateral (
  select t.abstract, t.locale
  from article_translations t
  where t.article_id = a.id and t.abstract is not null
  order by locale_rank(t.locale, l.locale, a.primary_language)
  limit 1
) fa on true
left join lateral (
  -- cardinality, not `is not null`: keywords is `not null default '{}'`, so an
  -- empty array is a present value and would end the fallback chain early.
  select t.keywords, t.locale
  from article_translations t
  where t.article_id = a.id and cardinality(t.keywords) > 0
  order by locale_rank(t.locale, l.locale, a.primary_language)
  limit 1
) fk on true
where a.state = 'published';

grant select on published_articles_localised to anon, authenticated;
```

> The `'{}'::text[]` cast is load-bearing. An untyped `'{}'` in that position
> resolves the column to `text` rather than `text[]`, the view builds without
> complaint, and the generated TypeScript then types `keywords` as `string`.

> Three correlated laterals per row is the readable formulation, not the fastest
> one. At journal scale — hundreds to a few thousand articles — it is
> irrelevant, and article pages filter to a single slug. If the sitemap or an
> OAI-PMH full harvest ever gets slow, that is the place to measure.

`translation_missing` still answers "was there a row for the locale the reader
asked for?", which is what drives the inline notice in `SPEC.md` §4.3. The
`*_locale` columns say which language each field actually came from — the notice
should name that language, and the `lang` attributes in the markup should match
it.

---

## Search

Ranking lives in SQL, not in TypeScript. Per-locale normalisation, the Uzbek
trigram blend, author matching, de-duplication, and pagination cannot be
expressed as PostgREST query parameters, and splitting them across two
languages would mean two implementations that drift.

Both functions are `security invoker` (the default) and `stable`, so RLS
applies to the caller: an anon search cannot see draft articles or draft posts.
Verified through the RPC endpoint, not only in psql.

**Two bugs worth not rediscovering**, both found by running this against the
seed data:

1. **`similarity()` silently breaks Uzbek search.** It compares whole strings,
   so a long title dilutes the score below any usable threshold. On the seed
   data, `iqtisodiyotning` against the Uzbek title scores **0.25** whole-string
   — under the 0.3 threshold, therefore no match — and **0.74** word-wise.
   Use `word_similarity`.
2. **`%>` is the wrong operator.** `a %> b` tests `word_similarity(b, a)`;
   it is the commutator of `<%`, not a synonym. Written the wrong way round it
   returns false for every long title, and the entire Uzbek fallback quietly
   does nothing while looking correct. `<%` also places the indexed column on
   the right, which is the side the GIN trigram index can accelerate.

Together those two are the difference between Uzbek search working and Uzbek
search returning nothing.

```sql
create or replace function locale_regconfig(l locale_code)
returns regconfig language sql immutable parallel safe as $$
  select case l
           when 'en' then 'english'::regconfig
           when 'ru' then 'russian'::regconfig
           else 'simple'::regconfig      -- uz: Postgres ships no Uzbek dictionary
         end;
$$;

create or replace function search_articles(
  search_query  text,
  in_locale     locale_code,
  all_locales   boolean      default false,
  filter_type   article_type default null,
  filter_year   int          default null,
  filter_jel    text         default null,
  filter_issue  uuid         default null,
  page_limit    int          default 20,
  page_offset   int          default 0
)
returns table (
  id             uuid,
  slug           text,
  matched_locale locale_code,
  title          text,
  abstract       text,
  published_at   timestamptz,
  volume         int,
  number         int,
  score          real,
  total          bigint
)
language sql stable parallel safe
set search_path = public, pg_temp
as $$
with q as (
  select nullif(btrim(search_query), '') as text
),
matches as (
  select
    t.article_id,
    t.locale,
    case
      when (select text from q) is null then 0::real
      else
        ts_rank_cd(
          t.search_vector,
          websearch_to_tsquery(locale_regconfig(t.locale), (select text from q))
        )
        -- Uzbek gets no stemming, so `iqtisodiyot` will not match
        -- `iqtisodiyotning`. Trigram carries that load, blended in rather than
        -- replacing the lexeme match.
        --
        -- word_similarity, NOT similarity: the latter compares whole strings,
        -- so a long title dilutes the score below any usable threshold.
        -- Measured on the seed data, `iqtisodiyotning` against the Uzbek title
        -- scores 0.25 whole-string (no match at the 0.3 threshold) and 0.74
        -- word-wise. Whole-string similarity silently breaks Uzbek search.
        + case
            when t.locale = 'uz' then 0.5 * greatest(
              word_similarity((select text from q), t.title),
              word_similarity((select text from q), coalesce(t.abstract, '')))
            else 0
          end
    end::real as raw_score
  from article_translations t
  -- With a query, scope to the locale's own text: you can only match words
  -- that exist. With NO query this is a browse view, and articles never hide
  -- (SPEC.md 4.3) -- so every published article must appear regardless of
  -- which locales it has been translated into, and the view resolves the
  -- fallback title. Scoping browse by locale silently shortened the Russian
  -- list to the subset with Russian translations.
  where ((select text from q) is null or all_locales or t.locale = in_locale)
    and (
      (select text from q) is null
      or t.search_vector @@ websearch_to_tsquery(
           locale_regconfig(t.locale), (select text from q))
      -- `<%`, not `%>`. They are commutators: `a %> b` tests
      -- word_similarity(b, a), which is the reverse of what is wanted and
      -- silently returns false for every long title. `<%` also puts the
      -- indexed column on the right, which is the side the GIN trigram index
      -- can accelerate.
      or (t.locale = 'uz'
          and ((select text from q) <% t.title
               or (select text from q) <% coalesce(t.abstract, '')))
    )
),
by_author as (
  -- SPEC.md 6: author names are searchable too.
  select distinct aa.article_id
  from article_authors aa
  join authors a on a.id = aa.author_id
  left join author_translations atr on atr.author_id = a.id
  where (select text from q) is not null
    and (a.family_name % (select text from q)
         or atr.display_name % (select text from q))
),
normalised as (
  -- Ranks from different dictionaries are not comparable: an `english` score
  -- and a `simple` score sit on different scales, and uz additionally carries
  -- a trigram component. Normalise within each locale before merging, or the
  -- union systematically buries one language.
  select
    article_id,
    locale,
    case
      when max(raw_score) over (partition by locale) > 0
        then raw_score / max(raw_score) over (partition by locale)
      else 0
    end::real as score
  from matches
),
scored as (
  -- Author matches join AFTER normalisation, at a fixed 0.5. Mixing them in
  -- beforehand let a raw 0.2 outrank a perfect title match, because ts_rank_cd
  -- values are small in absolute terms -- the author hit won on scale alone.
  -- Post-normalisation, a name match ranks below an exact title match and
  -- above a weak one, which is the intended ordering.
  select article_id, locale, score from normalised
  union all
  select article_id, in_locale, 0.5::real from by_author
),
best as (
  -- De-duplicate by article: one row per article, keeping its best locale.
  select
    article_id,
    (array_agg(locale order by score desc))[1] as locale,
    max(score) as score
  from scored
  group by article_id
),
filtered as (
  select b.locale as matched_locale, b.score, v.*
  from best b
  join published_articles_localised v
    on v.id = b.article_id and v.requested_locale = in_locale
  where (filter_type  is null or v.type = filter_type)
    -- Year comes from published_at, not issues.year: an online-first article
    -- has no issue and would vanish from every year-filtered view.
    and (filter_year  is null or extract(year from v.published_at) = filter_year)
    and (filter_jel   is null or filter_jel = any (v.jel_codes))
    and (filter_issue is null or v.issue_id = filter_issue)
)
select
  f.id, f.slug, f.matched_locale, f.title, f.abstract, f.published_at,
  f.volume, f.number, f.score,
  count(*) over () as total
from filtered f
order by f.score desc, f.published_at desc nulls last
limit page_limit offset page_offset;
$$;

-- Posts are searched separately and never mixed into article results: they are
-- two different categories (SPEC.md -> Weekly -> Search).
create or replace function search_posts(
  search_query  text,
  filter_locale locale_code default null,
  page_limit    int         default 20,
  page_offset   int         default 0
)
returns table (
  id             uuid,
  slug           text,
  handle         text,
  author_name    text,
  matched_locale locale_code,
  title          text,
  excerpt        text,
  published_at   timestamptz,
  score          real,
  total          bigint
)
language sql stable parallel safe
set search_path = public, pg_temp
as $$
with q as (
  select nullif(btrim(search_query), '') as text
),
matches as (
  select
    t.post_id,
    t.locale,
    t.title,
    t.excerpt,
    case
      when (select text from q) is null then 0::real
      else
        ts_rank_cd(
          t.search_vector,
          websearch_to_tsquery(locale_regconfig(t.locale), (select text from q))
        )
        + case
            when t.locale = 'uz'
              then 0.5 * word_similarity((select text from q), t.title)
            else 0
          end
    end::real as raw_score
  from post_translations t
  where (filter_locale is null or t.locale = filter_locale)
    and (
      (select text from q) is null
      or t.search_vector @@ websearch_to_tsquery(
           locale_regconfig(t.locale), (select text from q))
      or (t.locale = 'uz' and (select text from q) <% t.title)
    )
),
normalised as (
  select
    post_id, locale, title, excerpt,
    case
      when max(raw_score) over (partition by locale) > 0
        then raw_score / max(raw_score) over (partition by locale)
      else 0
    end::real as score
  from matches
),
best as (
  select distinct on (post_id)
    post_id, locale, title, excerpt, score
  from normalised
  order by post_id, score desc
)
select
  p.id, p.slug, pr.handle, pr.full_name,
  b.locale, b.title, b.excerpt, p.published_at, b.score,
  count(*) over () as total
from best b
join posts p on p.id = b.post_id and p.state = 'published'
join profiles pr on pr.id = p.author_id
order by b.score desc, p.published_at desc nulls last
limit page_limit offset page_offset;
$$;

grant execute on function search_articles(
  text, locale_code, boolean, article_type, int, text, uuid, int, int
) to anon, authenticated;
grant execute on function search_posts(text, locale_code, int, int)
  to anon, authenticated;
```

Posts are searched by a separate function and never mixed into article results:
they are two different categories (`SPEC.md` → **Weekly** → *Search*).

## Triggers

```sql
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger articles_touch before update on articles
  for each row execute function touch_updated_at();
-- repeat for issues, proposals

-- Slugs, DOIs, and PDF paths are permanent once published (SPEC.md §5.7).
-- `withdrawn` is included in the guard: without it, publish -> withdraw would
-- unlock the identifiers on the next update.
create or replace function guard_permanent_identifiers() returns trigger
language plpgsql as $$
begin
  if old.state in ('published', 'withdrawn') then
    if new.slug is distinct from old.slug then
      raise exception 'slug is immutable for published articles';
    end if;
    if old.doi is not null and new.doi is distinct from old.doi then
      raise exception 'doi is immutable once assigned';
    end if;
    if old.pdf_url is not null and new.pdf_url is distinct from old.pdf_url then
      raise exception 'pdf_url is immutable for published articles';
    end if;
  end if;
  return new;
end $$;

create trigger articles_guard_permanent before update on articles
  for each row execute function guard_permanent_identifiers();

-- A published article must have a title in its primary_language, or
-- citation_title is emitted empty. This cannot be a check constraint: the title
-- lives in another table. A *constraint* trigger deferred to commit lets the
-- admin form insert the article and its translations in one transaction, in
-- either order.
create or replace function require_primary_translation() returns trigger
language plpgsql as $$
begin
  if new.state = 'published' and not exists (
    select 1 from article_translations t
    where t.article_id = new.id
      and t.locale = new.primary_language
      and coalesce(t.title, '') <> ''
  ) then
    raise exception 'published article % has no % title',
      new.id, new.primary_language;
  end if;
  return null;
end $$;

create constraint trigger articles_require_primary_translation
  after insert or update on articles
  deferrable initially deferred
  for each row execute function require_primary_translation();

-- Weekly post slugs are permanent once published, for the same reason article
-- slugs are: a published URL that moves is a broken link.
create or replace function guard_post_slug() returns trigger
language plpgsql as $$
begin
  if old.state = 'published' and new.slug is distinct from old.slug then
    raise exception 'slug is immutable for published posts';
  end if;
  return new;
end $$;

create trigger posts_guard_slug before update on posts
  for each row execute function guard_post_slug();

create trigger posts_touch before update on posts
  for each row execute function touch_updated_at();

-- A published post must exist in at least one language.
create or replace function require_post_translation() returns trigger
language plpgsql as $$
begin
  if new.state = 'published' and not exists (
    select 1 from post_translations t
    where t.post_id = new.id and coalesce(t.title, '') <> ''
  ) then
    raise exception 'published post % has no translations', new.id;
  end if;
  return null;
end $$;

create constraint trigger posts_require_translation
  after insert or update on posts
  deferrable initially deferred
  for each row execute function require_post_translation();

-- Staff accounts are invite-only: an invite from the Supabase dashboard creates
-- the auth.users row and this mirrors it into profiles as an editor. There is
-- no public signup anywhere in this project.
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

**Consequence: publishing cannot be a sequence of `supabase.insert()` calls.**
The guard is deferred to commit, which means the article row and its
primary-language translation must land in the *same transaction*. Every
PostgREST request is its own transaction, so supabase-js cannot span the two —
inserting the article alone raises `published article … has no … title` at the
end of that request. Publish through a `security definer` Postgres function
(`publish_article(…)`) called as an RPC, which gets one transaction for the
article, its translations, and its author links. Verified: the two-statement
sequence fails outside a transaction and succeeds inside one.

> The primary-translation guard covers the article side. Deleting the last
> primary-language translation row out from under a published article is the
> mirror-image hole; the admin UI is the practical place to prevent it, but add
> the matching trigger on `article_translations` if you want it airtight.

---

## Writing: the publish RPC

Publishing an article touches three tables and must be atomic, because the
deferred constraint trigger requires the article and its primary-language
translation to commit together. **supabase-js cannot express that**: every
PostgREST request is its own transaction, so a sequence of `.insert()` calls
fails on the first one. Publishing therefore goes through a function.

`security definer` with a pinned `search_path`, because it writes across
several tables and re-checks staff identity itself rather than depending on
each table's policies lining up. The first thing it does is establish who is
calling; if that check fails nothing else runs.

```sql
create or replace function publish_article(
  payload jsonb
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_article_id uuid;
  v_translation jsonb;
  v_author jsonb;
  v_position int := 0;
begin
  if not is_staff() then
    raise exception 'not authorised';
  end if;

  -- Insert or update the article itself.
  v_article_id := nullif(payload->>'id', '')::uuid;

  if v_article_id is null then
    insert into articles (
      slug, issue_id, position, primary_language, type, pdf_url,
      pdf_size_bytes, first_page, last_page, jel_codes, license,
      state, published_at, received_at, accepted_at
    ) values (
      payload->>'slug',
      nullif(payload->>'issue_id', '')::uuid,
      nullif(payload->>'position', '')::int,
      (payload->>'primary_language')::locale_code,
      coalesce(nullif(payload->>'type', ''), 'research_article')::article_type,
      nullif(payload->>'pdf_url', ''),
      nullif(payload->>'pdf_size_bytes', '')::bigint,
      nullif(payload->>'first_page', '')::int,
      nullif(payload->>'last_page', '')::int,
      coalesce(
        (select array_agg(value::text)
         from jsonb_array_elements_text(payload->'jel_codes')), '{}'),
      coalesce(nullif(payload->>'license', ''), 'CC BY 4.0'),
      coalesce(nullif(payload->>'state', ''), 'draft')::publish_state,
      nullif(payload->>'published_at', '')::timestamptz,
      nullif(payload->>'received_at', '')::date,
      nullif(payload->>'accepted_at', '')::date
    )
    returning id into v_article_id;
  else
    update articles set
      issue_id         = nullif(payload->>'issue_id', '')::uuid,
      position         = nullif(payload->>'position', '')::int,
      primary_language = (payload->>'primary_language')::locale_code,
      type             = coalesce(nullif(payload->>'type', ''), 'research_article')::article_type,
      pdf_url          = coalesce(nullif(payload->>'pdf_url', ''), pdf_url),
      pdf_size_bytes   = nullif(payload->>'pdf_size_bytes', '')::bigint,
      first_page       = nullif(payload->>'first_page', '')::int,
      last_page        = nullif(payload->>'last_page', '')::int,
      jel_codes        = coalesce(
        (select array_agg(value::text)
         from jsonb_array_elements_text(payload->'jel_codes')), '{}'),
      license          = coalesce(nullif(payload->>'license', ''), 'CC BY 4.0'),
      state            = coalesce(nullif(payload->>'state', ''), 'draft')::publish_state,
      published_at     = nullif(payload->>'published_at', '')::timestamptz,
      received_at      = nullif(payload->>'received_at', '')::date,
      accepted_at      = nullif(payload->>'accepted_at', '')::date
    where id = v_article_id;
  end if;

  -- Translations. A tab left entirely blank is skipped, not stored empty:
  -- SPEC.md 7.1 requires publishing to succeed with one locale filled, and an
  -- empty-string title would defeat the primary-translation guard.
  delete from article_translations where article_id = v_article_id;

  for v_translation in
    select * from jsonb_array_elements(coalesce(payload->'translations', '[]'::jsonb))
  loop
    continue when coalesce(btrim(v_translation->>'title'), '') = '';

    insert into article_translations (article_id, locale, title, abstract, keywords)
    values (
      v_article_id,
      (v_translation->>'locale')::locale_code,
      btrim(v_translation->>'title'),
      nullif(btrim(coalesce(v_translation->>'abstract', '')), ''),
      coalesce(
        (select array_agg(btrim(value::text))
         from jsonb_array_elements_text(v_translation->'keywords')
         where btrim(value::text) <> ''), '{}')
    );
  end loop;

  -- Authors, in the order given. Positions are rewritten from scratch, which
  -- is why the unique constraint on (article_id, position) is deferrable.
  delete from article_authors where article_id = v_article_id;

  for v_author in
    select * from jsonb_array_elements(coalesce(payload->'authors', '[]'::jsonb))
  loop
    v_position := v_position + 1;
    insert into article_authors (article_id, author_id, position, is_corresponding)
    values (
      v_article_id,
      (v_author->>'author_id')::uuid,
      v_position,
      coalesce((v_author->>'is_corresponding')::boolean, false)
    );
  end loop;

  return v_article_id;
end $$;

-- from PUBLIC, not from anon. Postgres grants EXECUTE on a new function to
-- PUBLIC by default, so revoking from `anon` alone changes nothing: anon still
-- inherits it. Verified -- with only the anon revoke, an anon caller reached
-- the function body and was stopped by is_staff() rather than by the grant.
revoke execute on function publish_article(jsonb) from public;
grant execute on function publish_article(jsonb) to authenticated;
```

Both locks matter. `security definer` means this function runs with the
owner's privileges, so a caller who can execute it is writing to the scholarly
record with elevated rights regardless of RLS. The grant decides who may call
it at all; `is_staff()` decides whether the call proceeds. Neither is
sufficient alone, and the default `PUBLIC` grant is what makes the first one
easy to get wrong.

### `save_post`

The Weekly equivalent, and it exists for the same reason: a published post
must have at least one translation, the constraint trigger is deferred to
commit, and supabase-js cannot span a transaction across separate inserts.

Unlike `publish_article`, this one enforces **ownership**: an editor may write
their own series and an admin may write anyone's. That rule lives here as well
as in the RLS policies, because a `security definer` function bypasses the
policies of the tables it writes.

```sql
create or replace function save_post(payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_post_id uuid;
  v_author_id uuid;
  v_translation jsonb;
begin
  if not is_staff() then
    raise exception 'not authorised';
  end if;

  v_post_id := nullif(payload->>'id', '')::uuid;

  -- An editor writes their own series; an admin writes anyone's.
  v_author_id := coalesce(nullif(payload->>'author_id', '')::uuid, auth.uid());
  if v_author_id <> auth.uid() and not is_admin() then
    raise exception 'not authorised to write another editor''s series';
  end if;

  if v_post_id is null then
    insert into posts (author_id, slug, state, published_at)
    values (
      v_author_id,
      payload->>'slug',
      coalesce(nullif(payload->>'state', ''), 'draft')::publish_state,
      nullif(payload->>'published_at', '')::timestamptz
    )
    returning id into v_post_id;
  else
    -- Re-check ownership of the row as it stands, not just the payload:
    -- otherwise an editor could pass someone else's post id with their own
    -- author_id and take it over.
    if not exists (
      select 1 from posts p
      where p.id = v_post_id and (p.author_id = auth.uid() or is_admin())
    ) then
      raise exception 'not authorised to write this post';
    end if;

    update posts set
      author_id    = v_author_id,
      slug         = payload->>'slug',
      state        = coalesce(nullif(payload->>'state', ''), 'draft')::publish_state,
      published_at = nullif(payload->>'published_at', '')::timestamptz
    where id = v_post_id;
  end if;

  -- A language with no title is a language the post was not written in. It is
  -- removed, not stored empty: the presence of a row is what makes the post
  -- exist in that locale (SPEC.md -> Weekly -> Languages).
  delete from post_translations where post_id = v_post_id;

  for v_translation in
    select * from jsonb_array_elements(coalesce(payload->'translations', '[]'::jsonb))
  loop
    continue when coalesce(btrim(v_translation->>'title'), '') = '';

    insert into post_translations (post_id, locale, title, excerpt, body)
    values (
      v_post_id,
      (v_translation->>'locale')::locale_code,
      btrim(v_translation->>'title'),
      nullif(btrim(coalesce(v_translation->>'excerpt', '')), ''),
      -- Already sanitised by the caller. The column is documented as holding
      -- sanitised HTML; this function does not re-clean it, so the server
      -- action that calls it must never be bypassed.
      coalesce(v_translation->>'body', '')
    );
  end loop;

  return v_post_id;
end $$;

revoke execute on function save_post(jsonb) from public;
grant execute on function save_post(jsonb) to authenticated;
```

## Seed data

Seed before building any UI:

- 1 published issue (vol 1, no 1) and 1 draft issue
- 3 published articles: one `primary_language = 'en'` with all three
  translations, one `'ru'` with `ru` + `en` only, one `'uz'` with `uz` only
  (this last one exercises the fallback path — do not skip it)
- 1 draft article, to verify RLS hides it from the anon key — query the
  **view** with the anon key too, not only the tables
- 1 published article with `issue_id = null`: online first, therefore no volume,
  number, or year. It is the seed that catches every query joining through
  `issues` with an inner join, and every filter that reads `issues.year`
- 1 article with a deliberately half-filled translation (say a `ru` title with
  no `ru` abstract) to exercise **field-level** fallback in the view
- 5 authors, at least two shared across articles, with `en`/`ru`/`uz` display
  names including Cyrillic forms in `ru`
- 2 proposals in different states
- 2 editors with handles, and 3 Weekly posts: one in all three languages, one
  in English only, and one draft. The English-only post is what proves a
  language filter removes it rather than falling back, and the draft proves
  post RLS holds.

The single-locale Uzbek article, the draft article, and the online-first article
are the seeds that catch the bugs that matter. Seeding is not done until an
anon-key query for the draft returns zero rows from both the table and the
view.

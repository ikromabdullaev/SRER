-- GENERATED FROM DevelopmentPlan/SCHEMA.md -- DO NOT EDIT BY HAND.
-- Regenerate with `npm run db:extract`. Edit SCHEMA.md instead: it is the
-- source of truth for the data model and outranks this file.

-- ===== block 1 : Extensions =====
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;      -- Uzbek trigram search
create extension if not exists unaccent;

-- ===== block 2 : Immutable helpers =====
create or replace function immutable_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe as $$
  select array_to_string(arr, sep);
$$;

-- ===== block 3 : Immutable helpers =====
create or replace function immutable_unaccent(t text)
returns text language sql immutable parallel safe as $$
  select unaccent('unaccent'::regdictionary, t);
$$;

-- ===== block 4 : Enums =====
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

-- ===== block 5 : `profiles` =====
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

-- ===== block 6 : `issues` =====
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

-- ===== block 7 : `articles` =====
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

-- ===== block 8 : `article_translations` =====
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

-- ===== block 9 : `authors` =====
create table authors (
  id            uuid primary key default uuid_generate_v4(),
  family_name   text not null,     -- Latin, canonical
  given_name    text not null,     -- Latin, canonical
  orcid         text unique,
  email         text,
  website_url   text,
  created_at    timestamptz not null default now(),

  constraint orcid_format
    check (orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$')
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

-- ===== block 10 : `proposals` =====
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

-- ===== block 11 : `posts` =====
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

-- ===== block 12 : `post_translations` =====
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

-- ===== block 13 : Defined but unused in v1 =====
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

-- ===== block 14 : Indexes =====
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

-- ===== block 15 : Row Level Security =====
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

-- Staff full access
create policy "staff manage articles" on articles
  for all using (is_staff()) with check (is_staff());
-- ...repeat for every content table...

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

-- ===== block 16 : Grants =====
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
grant select (id, family_name, given_name, orcid, website_url, created_at)
  on authors to anon, authenticated;

-- profiles is column-restricted for the Weekly byline. `role` is withheld:
-- which accounts are admins is not public information.
grant select (id, handle, full_name, bio) on profiles to anon, authenticated;

-- ===== block 17 : Views =====
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

-- ===== block 18 : Triggers =====
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

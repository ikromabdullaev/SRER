# SPEC.md — Journal Website

> Working document for the scholarly journal published by the Economic Society of
> Uzbekistan in collaboration with [UNIVERSITY]. Replace `[JOURNAL_NAME]`,
> `[UNIVERSITY]`, `[DOI_PREFIX]`, `[ISSN]`, and `[SITE_URL]` once confirmed.
>
> **This file is the source of truth for scope and behaviour. `SCHEMA.md` is the
> source of truth for data. If code and these files disagree, the files win —
> update them deliberately, don't drift.**

---

## Open decisions

§2 is settled. These are not. Each entry names the step in §10 it blocks; when
one is resolved, move it into §2 and delete it from here. Identifiers are stable
— resolved entries are not renumbered, so references from `SCHEMA.md` keep
pointing at the right thing.

*Resolved:* **D1** (DOI pattern) and **D4** (is a DOI mandatory to publish) both
fell away when DOIs left the current scope — see §2. Neither needs an answer
until the journal actually registers a prefix.

**D2 — The public origin.** *Blocks step 3.*
Written as `https://.../` throughout. It is baked into every canonical URL,
`citation_pdf_url`, the Crossref resource URL, the OAI-PMH `baseURL`, and the
sitemap — all permanence-constrained, which makes it nearly as hard to change
later as the DOI prefix. Tracked as `[SITE_URL]`; the domain and its DNS are in
the §12 checklist.

**D3 — What a withdrawn article does.** *Blocks step 8; shapes RLS now.*
`publish_state` carries a `withdrawn` value that nothing defines. The RLS
policies expose only `state = 'published'`, so withdrawing an article 404s a URL
§5.7 calls permanent and that a registered DOI resolves to — Crossref flags dead
resources, and OAI-PMH needs a deleted-record policy regardless.
*Recommended:* a tombstone. The landing page and its metadata stay reachable
behind a prominent notice and only the PDF may be pulled; RLS then reads
`state in ('published', 'withdrawn')` and every public query filters
deliberately. Decide at the same time whether `withdrawn` and the `retraction`
article type are one event described twice, and which record carries
`supersedes_id` — the name implies the correction points back at the original,
but that is nowhere stated.

**D5 — JEL vocabulary.** *Blocks step 5.*
`jel_codes` is a free-text array and §6 offers a JEL filter over it. Either check
the official JEL tree into the repo as JSON, or accept free entry with an
autocomplete over values already in use — but a filter over uncontrolled text
will not hold up.

**D6 — Author page URLs.** *Blocks step 4.*
§4.4 uses `/authors/{uuid}`. Indexed URLs are permanent in practice, so an
author slug is much cheaper to adopt now than after Scholar has crawled them.
*Recommended:* add `authors.slug` and keep the UUID out of the URL.

**D7 — Rate-limit store for the proposal form.** *Blocks step 7.*
§8 requires a per-IP limit; Vercel functions are stateless. *Recommended:* a
`proposal_rate_limit` table written by the same server-side handler that owns
`source_ip` — Supabase is already a dependency and the volume is trivial.

**D8 — `unaccent`.** *Blocks step 5.*
The extension is installed in `SCHEMA.md` and wired into nothing. Either fold it
into the trigram indexes through an immutable wrapper, or drop it.

---

## 1. What this is

A public website and publication database for a peer-reviewed academic journal
in economics. It hosts the journal's permanent scholarly record: issues,
articles, PDFs, and the metadata that makes those articles discoverable by
Google Scholar, DOAJ, Crossref, and regional aggregators.

**It is not a manuscript management system.** All editorial work (review,
decisions, copyediting) happens off-platform. The site publishes finished work
and collects proposals.

## 2. Decisions already made

These are settled. Do not relitigate them in code.

| Decision | Value |
|---|---|
| Languages | English, Uzbek (**Latin script only**), Russian |
| Editorial workflow | None in-app. Partner publishes everything via admin UI. |
| Author submissions | Proposal form only → email to admins → offline contact |
| Hosting | Vercel |
| Database / storage / auth | Supabase (Postgres, Storage, Auth) |
| Framework | Next.js, App Router, TypeScript |
| Rendering | Static generation + ISR. **Never client-side render article metadata.** |
| Licence | CC BY 4.0 (open access, no fees) |
| DOIs | **Not in scope at this stage.** `articles.doi` stays nullable; nothing mints, requires, or deposits a DOI. |
| DOI registrar (later) | Crossref, via Global Equitable Membership (Uzbekistan is eligible — no membership or registration fees) |

## 3. Non-goals for v1

Explicitly out of scope. Do not build these, do not stub UI for them.

- In-app peer review, reviewer accounts, or decision letters
- Author self-service accounts or manuscript tracking
- ORCID OAuth login (the ORCID *field* is stored; login is not built)
- HTML full-text rendering of **articles** (the PDF is the article of record).
  This does not apply to Weekly posts, a separate content type where the text
  *is* the record — see **Weekly**.
- Article-level analytics dashboards
- Comments, altmetrics, social features
- Payment of any kind

Schema for reviews and editorial decisions **is** defined in `SCHEMA.md` so the
tables exist and relationships are correct. Leave them unused.

---

## 4. Internationalisation

### 4.1 Two separate concerns

1. **UI chrome** (nav, buttons, labels, form validation) — `next-intl`, three
   message catalogues, complete for all locales at all times.
2. **Article metadata** (title, abstract, keywords, author display names and
   affiliations) — stored per-locale in the database, **may be incomplete**.

Do not conflate these. UI strings are always present; content translations are
frequently missing and the site must degrade gracefully.

### 4.2 Locales

```
en  English
uz  Uzbek — Latin script only. No Cyrillic content is stored or accepted.
ru  Russian — Cyrillic.
```

`primary_language` on an article records the language of the **PDF full text**.
This is independent of which translations exist.

### 4.3 Fallback rules

When a user views an article in locale `L` and no `article_translations` row
exists for `L`:

1. Render the article page in `L` (UI chrome in `L`).
2. Show title/abstract/keywords from `primary_language`.
3. Display an inline notice in `L`: "This abstract is not yet available in
   [language]." Do not hide the article and do not 404.

Fallback order: requested locale → `primary_language` → `en` → any available.

Fallback is resolved **per field, not per record**. §7.1 lets an editor save a
language tab with a title and no abstract, so the common case is a translation
row that exists but is half-filled; taking the whole row on a hit would surface
an empty abstract instead of falling through to one that exists. The
`published_articles_localised` view implements this in SQL and returns, per
field, which locale the value came from — use it rather than reimplementing the
chain in TypeScript. Name the actual source language in the notice, and set
`lang` on the element to match, since a page may legitimately mix languages.

### 4.4 Routing

```
/[locale]/                          home
/[locale]/issues                    all issues, newest first
/[locale]/issues/[volume]/[number]  single issue, table of contents
/[locale]/online-first              published, not yet assigned to an issue
/[locale]/weekly                    all Weekly posts, newest first
/[locale]/weekly/[handle]           one editor's Weekly series
/[locale]/weekly/[handle]/[slug]    a single Weekly post
/[locale]/articles/[slug]           single article
/[locale]/authors/[id]              author page, all their articles
/[locale]/search                    search results
/[locale]/about                     aims & scope
/[locale]/editorial-board
/[locale]/for-authors               guidelines, licence, ethics, review policy
/[locale]/submit                    proposal form
/[locale]/policies/[policy]         peer review, ethics, archiving, open access
```

**The `slug` is identical across all three locales.** Only the locale prefix
changes. `/en/articles/foo` and `/ru/articles/foo` are the same article.

`/` (no locale) redirects to `/en/` — a plain 308, not content negotiation.
Predictable URLs matter more than clever defaults for crawlers.

### 4.5 Slug rules

- Generated once at publication from a Latin transliteration of the English
  title (or `primary_language` title if there is no English one), truncated to
  ~60 characters, lowercase, hyphenated.
- Romanise Cyrillic with **BGN/PCGN**. Pin the library and its version: two
  transliteration schemes produce two different slugs for the same title, and
  slugs are permanent, so this cannot be left to whichever package is installed.
  Uzbek is already Latin and needs only ASCII folding.
- **Permanent.** Once an article is published the slug never changes. If a title
  is corrected, the slug stays.
- Uniqueness enforced at the database level. On collision, append `-2`, `-3`.
- If any of this feels risky, fall back to structural slugs (`v1n1-a03`). Ugly
  URLs that never break beat pretty URLs that do.

---

## 5. Discoverability requirements

This section is the reason the project exists. Treat it as a hard requirement,
not a nice-to-have.

### 5.1 Google Scholar meta tags

Every article page emits, **server-rendered in the initial HTML**:

```html
<meta name="citation_title" content="...">
<meta name="citation_author" content="Family, Given">   <!-- one per author, in order -->
<meta name="citation_author_institution" content="...">  <!-- follows its author tag -->
<meta name="citation_journal_title" content="[JOURNAL_NAME]">
<meta name="citation_issn" content="[ISSN]">
<meta name="citation_volume" content="1">
<meta name="citation_issue" content="1">
<meta name="citation_firstpage" content="12">
<meta name="citation_lastpage" content="34">
<meta name="citation_publication_date" content="2026/03/15">
<meta name="citation_doi" content="10.xxxxx/...">
<meta name="citation_pdf_url" content="https://.../article.pdf">
<meta name="citation_keywords" content="...">            <!-- semicolon-separated -->
<meta name="citation_language" content="en">
<meta name="citation_online_date" content="2026/02/01">  <!-- online-first only -->
```

**Critical rules:**

- Emit `citation_title` **exactly once**, in the article's `primary_language`.
  Never emit one per locale — Scholar indexes the result as garbage.
- `citation_author` uses `Family, Given` order, one tag per author, in author
  order. Use the Latin form of the name.
- `citation_pdf_url` must be a direct, permanent, unauthenticated link to the
  PDF. No signed URLs, no redirects, no expiry.
- `citation_keywords` follows the same single-locale rule as `citation_title`:
  the `primary_language` keywords, once, semicolon-separated.
- `citation_online_date` is emitted only for articles first published ahead of an
  issue. When such an article is later assigned to an issue,
  `citation_publication_date` becomes the issue date and the online date stays —
  Scholar uses the pair to establish priority. Neither the URL, the PDF path,
  nor the DOI changes.
- Omit a tag rather than emitting it empty. An article with no issue has no
  `citation_volume`, `citation_issue`, or page range, and `<meta content="">`
  reads as a claim that the value is blank.
- **`citation_doi` is omitted entirely at this stage**, since no article has a
  DOI. Scholar does not require one — it indexes on title, authors, and
  `citation_pdf_url`. Treat the tag as conditional on `doi is not null` and it
  starts appearing by itself if DOIs are adopted later.
- These tags must appear in the HTML response body. If the page fetches metadata
  client-side, Scholar sees an empty document and the journal is invisible.

### 5.2 Canonical and alternates

The canonical page for each article is the locale matching `primary_language`.

```html
<link rel="canonical" href="https://.../{primary_language}/articles/{slug}">
<link rel="alternate" hreflang="en" href="https://.../en/articles/{slug}">
<link rel="alternate" hreflang="uz" href="https://.../uz/articles/{slug}">
<link rel="alternate" hreflang="ru" href="https://.../ru/articles/{slug}">
<link rel="alternate" hreflang="x-default" href="https://.../en/articles/{slug}">
```

Non-canonical locale pages carry the full `hreflang` set and a canonical
pointing at the primary-language page. They do **not** carry `citation_*` tags.

### 5.3 Structured data

Emit JSON-LD `ScholarlyArticle` on article pages (`headline`, `author`,
`datePublished`, `isPartOf` → `PublicationIssue` → `Periodical`, `license`,
`inLanguage`).

`identifier` carries the DOI when there is one. There is none at this stage, so
omit the key rather than emitting an empty or placeholder value — the article
URL in `@id`/`url` is the identifier that matters until then.

### 5.4 OAI-PMH

Expose `/api/oai` implementing OAI-PMH 2.0, verbs: `Identify`,
`ListMetadataFormats`, `ListSets`, `ListIdentifiers`, `ListRecords`,
`GetRecord`. Metadata format `oai_dc` (Dublin Core) is mandatory.

For multilingual records, emit repeated `<dc:title>` and `<dc:description>`
elements with `xml:lang` attributes — one per available translation. This is the
one place where all locales appear together, and it is correct here.

Three details that are easy to miss and that harvesters do check:

- **Sets.** `ListSets` is mandatory once advertised, and the sets must be
  defined. Use `type:{article_type}` and `issue:v{volume}n{number}`; online-first
  articles belong to no issue set, which is correct and must not throw.
- **Resumption tokens.** `ListRecords` and `ListIdentifiers` must page. Pick a
  page size (100 is conventional) and encode the cursor in the token.
- **Deleted records.** `Identify` must declare a `deletedRecord` policy, and it
  has to agree with whatever §D3 decides about withdrawn articles. Declaring
  `persistent` and then dropping the record from the feed is a protocol
  violation that will fail a DOAJ review.

Required by DOAJ and by most regional aggregators. It is a few hours of work and
it is the difference between being harvested and being ignored.

### 5.5 Crossref deposit — deferred

**Not built at this stage.** DOIs are out of scope (§2), so there is nothing to
deposit. This section records the target for when a prefix exists; do not build
against it now, and do not let a half-finished deposit generator accumulate in
the codebase.

The deferral is cheap because the schema already supports it: `articles.doi` is
nullable, and the permanence trigger locks a DOI only once it is assigned
(`old.doi is not null`). Assigning DOIs later — including to articles that are
already published — is a plain `UPDATE`, verified against a live database. What
must **not** drift in the meantime is the article URL, because whatever DOI is
eventually registered will resolve to it.

Generate Crossref `journal_article` deposit XML (schema 5.3.1 or current) for a
selected issue. Output the XML file for manual upload to the Crossref admin
portal; automated API deposit is a later improvement.

DOI pattern: to be decided when a prefix is assigned. Note that the obvious
`v{volume}n{number}.{article_number}` shape cannot express an online-first
article, which has no issue — an issue-independent counter avoids that trap.

Deposit the multilingual titles using `<titles>` with `original_language_title`
where applicable.

`<doi_data><resource>` must be the **canonical landing page** — the
`primary_language` locale, matching §5.2 — never a locale variant and never the
PDF. Crossref resolves the DOI to that URL forever, so it inherits every
permanence rule in §5.7.

### 5.6 Sitemap and robots

- `/sitemap.xml` — all locale variants of all published articles, issues, and
  static pages, with `hreflang` alternates in the sitemap entries.
- `robots.txt` allows everything except `/admin` and `/api/admin`.
- Never `noindex` an article. Never gate a PDF.

### 5.7 Permanence

- Article URLs and PDF URLs are permanent. No restructuring, ever.
- Corrections are published as separate records linked to the original, not by
  silently editing the PDF. Retractions likewise.
- State an archiving policy on the site (PKP Preservation Network is free and
  appropriate). DOAJ asks for this.

---

## 6. Search

Per-locale full-text search over `article_translations` (title, abstract,
keywords) plus author names.

**Text search configuration by locale:**

| Locale | Config | Notes |
|---|---|---|
| `en` | `english` | Stemming works. |
| `ru` | `russian` | Stemming works. |
| `uz` | `simple` | **Postgres has no Uzbek dictionary.** No stemming. |

Because `uz` gets no stemming, `iqtisodiyot` will not match `iqtisodiyotning`.
Compensate with a `pg_trgm` GIN index on Uzbek titles and abstracts and blend
trigram similarity into the ranking for that locale. Latin-only script does not
solve this — it is a morphology problem, not a script problem.

**Search behaviour:**

- Default scope: the current locale's translations, ranked by `ts_rank_cd`.
- Offer a "search all languages" toggle that unions across locales and
  de-duplicates by `article_id`. **Ranks from different dictionaries are not
  comparable** — an `english` score and a `simple` score are on different
  scales, and `uz` additionally blends trigram similarity. Normalise per locale
  before merging (rank / max-rank within that locale's result set), then take
  the best-scoring row per `article_id`. Sorting the raw union by score
  systematically buries one language.
- Filters: issue, year, `article_type`, JEL code, author. **Year comes from
  `articles.published_at`, not `issues.year`** — online-first articles have no
  issue, and reading the year through the join drops them from every
  year-filtered view.
- Empty query with filters applied is valid — it becomes a browse view.
- Paginate. Keep it offset-based and put the page in the URL: search results
  should be linkable and crawlable.

---

## 7. Admin

Route namespace `/admin`, English-only UI, guarded by Supabase Auth plus a role
check. Not locale-prefixed.

**There is no signup, public or otherwise.** Staff accounts are created by
inviting the address from the Supabase dashboard; a trigger on `auth.users`
mirrors the account into `profiles` as an `editor`, and an existing `admin`
promotes it if needed. Guard `/admin` in middleware *and* re-check the role in
every server action — middleware alone protects the page, not the mutation
behind it.

### 7.1 Article publishing form

The primary internal surface. Give it real design attention — the partner's
editors will live here.

- **Language tabs** for `en` / `uz` / `ru`, each with title, abstract,
  keywords. A tab may be left entirely blank.
- **Author repeater** — reorderable. Per author: family name, given name, ORCID,
  email, corresponding flag, plus per-locale display name and affiliation.
  Autocomplete against existing `authors` so the same person isn't duplicated
  across issues.
- PDF upload → Supabase Storage, public bucket, permanent path.
- Issue assignment, page range, `article_type`, `primary_language`, JEL codes,
  and licence. **The DOI field is omitted at this stage** — leave `doi` null
  rather than showing an input nobody can fill. Reinstate it as an optional
  field if a prefix is ever assigned.
  DOI, licence.
- **Publishing must succeed with only one locale filled.** Show a "translations
  incomplete" badge in the article list. Never block on missing translations.
- **Publish through a single RPC, not a sequence of inserts.** The article row
  and its `primary_language` translation must commit together (`SCHEMA.md`
  enforces it with a deferred constraint trigger), and each supabase-js call is
  its own transaction. A `publish_article(...)` Postgres function is the unit of
  work — article, translations, and author links in one atomic call. This also
  makes the "one locale filled" rule enforceable rather than aspirational.
- Never `select('*')` on `authors` from a public query: the email column is
  withheld by a column-level grant, so a star-select fails outright for the anon
  role. Name the columns.
- Separate `draft` / `published` states. Drafts are invisible publicly and
  excluded from sitemap, OAI-PMH, and search.
- Publishing must invalidate the cache on the spot: the article page, its issue,
  the archive, the homepage, and the sitemap. See §11 on revalidation — an
  editor who publishes and then sees a stale page will publish again.

### 7.2 Issue management

Create issues, assign articles, order the table of contents, set the publication
date, publish the issue. Support **online-first**: an article may be published
with a DOI and a permanent URL before it is assigned to an issue.

### 7.3 Proposals inbox

List, filter by status, view detail, download attachment, change status, write
internal notes. No reply-from-app feature — admins email the researcher
directly.

### 7.4 Roles

`admin` (full access) and `editor` (everything except user management). Stored
on a `profiles` row keyed to `auth.users`.

---

## 8. Proposal submission

Public form at `/[locale]/submit`.

Fields: name, email, affiliation, proposed title, abstract, preferred language,
optional file upload (PDF/DOCX, ≤ 20 MB), optional co-author note.

On submit: write to `proposals`, upload file to a **private** bucket, send a
notification email to the editorial address via Resend, send a confirmation
email to the submitter, show a success state explaining that an editor will be
in touch.

**The submission path is server-side, and the file does not travel through it.**
Two constraints force this shape:

- A 20 MB body cannot pass through a Vercel serverless function (the limit is
  around 4.5 MB), and anonymous users cannot write to a private bucket. So the
  handler mints a **signed upload URL** and the browser uploads straight to
  Supabase Storage, then posts the resulting path with the rest of the form.
- The row is inserted with the service-role key by a Route Handler, and
  `proposals` carries **no anonymous insert policy**. An anon insert would let a
  caller set `state`, `admin_notes`, and `source_ip` freely — which makes
  `source_ip` useless for the rate limit below. The server owns the IP, the
  initial state, and the file path it just issued.

Validate size and MIME type when minting the URL, and again after upload from
the stored object — the client controls what it actually sends.

Spam protection: honeypot field plus a simple rate limit by IP (store per **D7**).
No CAPTCHA — it degrades the experience for the exact people you want
submitting.

---

## 9. Content pages

`about`, `editorial-board`, `for-authors`, `policies/*`.

These must exist in all three locales **before launch** — DOAJ evaluates them.
Required content: aims and scope, editorial board with real names and
affiliations, peer review policy (state the model explicitly: single-anonymous,
double-anonymous, etc.), publication ethics and malpractice statement (base it
on COPE guidance), open access and licensing statement, archiving policy,
authorship and conflict-of-interest policy, and a statement that no fees are
charged.

Store as MDX in the repo, one file per locale, at
`content/{locale}/{page}.mdx`. These change rarely and don't need to be in the
database.

**The article fallback rules in §4.3 do not apply here.** These pages are
required to be complete in all three locales — DOAJ reads them — so a missing
file is a build error, not a fallback. Assert the full matrix in a test at build
time; discovering a missing Uzbek ethics statement during a DOAJ review is
expensive, and discovering it in CI is free.

---

## Weekly — the editorial series

A second content type, separate from the scholarly record in the database, in
the UI, and in what search engines are told about it.

Editors write or paste pieces directly into the site — a recurring commentary
series, one per editor. There is no PDF, no peer review, no DOI, and no issue.
The text is the record.

### Why it is not an `article_type`

Three reasons, and the first two are the ones that matter:

1. **`published_needs_pdf`.** Every published article is constrained to have a
   PDF. Relaxing that constraint to accommodate Weekly posts would weaken a
   real guarantee protecting the scholarly record, for the benefit of content
   that is not part of it.
2. **Emitting `citation_*` for a Weekly post would harm the journal.** It tells
   Google Scholar that an editorial column is a peer-reviewed journal article,
   which dilutes the journal's record, and DOAJ assesses what a journal claims
   as content. Posts carry ordinary `Article` JSON-LD, appear in the sitemap,
   and are **excluded from OAI-PMH**, which stays the peer-reviewed record.
3. It is the same reasoning `SCHEMA.md` already applies to `proposals` versus
   `articles`: separate things stay separate, so every public query is safe by
   construction.

### Authorship

A post belongs to the editor who wrote it — a `profiles` row, not an `authors`
entity. `authors` are researchers in the scholarly record; editors are staff.
The URL carries the editor's handle, so `profiles` gains a public, URL-safe
`handle` and only the columns needed for a byline are readable publicly. The
`role` column stays private: who is an admin is not public information.

### Languages — different from articles, deliberately

Articles never hide. A missing translation degrades to `primary_language` with
a notice, because the scholarly record must stay reachable (§4.3).

Posts behave differently: a post exists **only in the languages it was written
in**. An editor may write one language or all three.

- The Weekly listing shows every published post regardless of language, each
  marked with the languages it is available in.
- When the reader filters by language, posts without that language **are
  removed from the list**. No fallback, no notice.
- Requesting a post in a locale it does not exist in **redirects (308) to an
  available locale** — preferring the reader's locale, then the post's original
  language. It does not 404 and it does not render a fallback page: a shared
  link must keep working, but there is no reason to publish an English post at
  a Russian URL.
- `hreflang` therefore lists **only the locales a post actually exists in**,
  which is what those URLs are for.

### Editing

The admin editor (build step 6) supports headings, bold, italic, lists, links,
block quotes, tables, footnotes, and images. **No mathematical notation** —
LaTeX is explicitly out of scope.

Pasted content is **sanitised on save against a strict allowlist**. Pasting from
Word or Google Docs carries a large amount of junk markup, and some paste
formatting will be dropped on purpose. Store the sanitised HTML; sanitise
server-side, never trusting the client to have done it.

Images are uploaded to a public `post-images` bucket. `<img>` is allowed only
with a `src` inside that bucket, so a sanitised post cannot hotlink or beacon.

### Search

Posts and articles are **separate categories and are never mixed in one result
list** (§6 governs article search only). Posts have their own search over their
own tsvectors, scoped to the Weekly section, with the same per-locale
configuration and the same Uzbek trigram compensation.

---

## 10. Build order

Follow this sequence. Each step is verifiable before the next begins.

0. **Toolchain.** Next.js + TypeScript strict, Vitest for unit and database
   tests, Playwright for the handful of end-to-end checks that matter (view
   source on an article page, submit a proposal). Lint and typecheck wired into
   CI before step 1, because the RLS test in step 1 is the first thing that has
   to run automatically and keep running.
1. **Schema + migrations.** Seed exactly what `SCHEMA.md` → *Seed data* lists —
   it is the authoritative list and it is deliberately larger than a happy path.
   Everything downstream is testable from here. Step 1 is not done until an
   anon-key query proves the draft article is invisible through both the table
   and the view.
2. **`next-intl` routing skeleton.** `/[locale]/` working with a language
   switcher and placeholder pages. Get this right before real pages exist —
   retrofitting locale routing is miserable.
3. **Article page.** Correct canonical, `hreflang`, `citation_*` tags, JSON-LD.
   Verify by viewing source, not devtools — devtools shows the hydrated DOM,
   which is precisely the thing that lies to you here. Snapshot-test the emitted
   tags against the Uzbek-only seed article so the fallback path is covered.
   Establish the cache-tag scheme now (see §11); retrofitting invalidation at
   step 6 means revisiting every page built between here and there. This is the
   highest-value page.
4. **Issue archive and homepage.** Plus the public Weekly pages: the listing,
   an editor's series, and a single post. Reading comes before writing — the
   editor UI is step 6.
5. **Search.** Per-locale tsvector, trigram fallback for `uz`, filters.
6. **Supabase auth + admin publishing form**, and the Weekly editor: rich text,
   sanitising paste, image upload.
7. **Proposal form → DB → Resend.**
8. **OAI-PMH endpoint + sitemap.** The Crossref generator is deferred with §5.5.
9. **Design pass.** Not before this point.

---

## 11. Conventions

- TypeScript strict mode. No `any`.
- Database access through typed Supabase client; generate types from the schema,
  never hand-write them.
- Server Components by default. Client Components only for genuine interactivity
  (language switcher, search input, admin forms).
- Dates stored as `timestamptz`, displayed per-locale.
- No secrets in client code. Supabase service-role key server-side only.
- Row Level Security enabled on every table. Public read is a policy, not the
  absence of one. Views need `security_invoker`; RLS does not reach through a
  view by default.
- Journal-level constants — `[JOURNAL_NAME]`, `[ISSN]`, `[DOI_PREFIX]`,
  `[SITE_URL]`, the Crossref depositor details — live in **one typed config
  module**, not scattered through components and not in the database. They are
  read by the article page, the sitemap, the OAI-PMH endpoint, and the Crossref
  generator; one file makes resolving the placeholders a single edit.
- **Revalidation is on-demand, not time-based.** Tag article pages by slug and
  issue pages by volume/number, and have the admin publish action call
  `revalidateTag`. A time-based `revalidate` window is a fallback, not the
  mechanism — an editor must see a publish go live immediately.
- Dates stored as `timestamptz`, displayed per-locale. The exceptions are
  `received_at` and `accepted_at`, which are `date`: they are editorial
  milestones printed as days, and a timezone on them is a false precision that
  shifts the printed date for some readers.
- Tests that must exist before the feature is called done: anon key cannot read
  drafts (tables **and** views); `citation_*` appears in the raw HTML response;
  the locale-fallback article renders with a notice and does not 404; the
  content-page matrix is complete in all three locales.
- `next-intl`'s middleware negotiates `Accept-Language` by default. Turn that
  off — §4.4 wants a plain 308 from `/` to `/en/`. The library default and this
  spec disagree, and the spec wins.

---

## 12. Pre-launch checklist (non-code)

These have long lead times and gate the indexing timeline. Start them now,
independent of build progress.

- [ ] Domain registered and DNS delegated — this is `[SITE_URL]` (**D2**), and
      it is baked permanently into every canonical URL, PDF link, and DOI
      resource URL. Decide it before step 3, not before launch.
- [ ] Resend sending domain verified (SPF/DKIM), and the editorial address that
      receives proposal notifications confirmed
- [ ] ISSN from the national ISSN centre (National Library of Uzbekistan)
- [ ] Crossref membership via [UNIVERSITY], under the GEM programme — *deferred,
      does not block the build or launch*
- [ ] DOI prefix assigned — *deferred; can be adopted after articles are live
      without touching their URLs*
- [ ] Editorial board confirmed, with real names and affiliations
- [ ] All policy pages written and translated
- [ ] Licence decided and stated (CC BY 4.0)
- [ ] Archiving arrangement (PKP PN)
- [ ] Google Scholar inclusion request — only after ~5 articles are live
- [ ] DOAJ application — needs ISSN plus 5 articles or one year of publishing

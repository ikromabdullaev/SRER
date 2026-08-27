# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Greenfield. The repository currently contains only planning documents — no application code, no
`package.json`, no toolchain. There are no build, lint, or test commands yet; they are established
by step 0 of the build order below. This is not a git repository.

## Source of truth

Two documents govern this project and outrank the code:

- `DevelopmentPlan/SPEC.md` — scope and behaviour.
- `DevelopmentPlan/SCHEMA.md` — the data model.

If code and these files disagree, **the files win**. Change them deliberately before changing code
to match; do not let the code drift and then retrofit the docs. Read both before any non-trivial
work — the summary below is orientation, not a substitute.

`SPEC.md` opens with an **Open decisions** section. Those are genuinely unresolved and each names
the build step it blocks. Do not invent an answer and build on it; resolve the decision, move it
into §2, and delete the entry. Identifiers are stable, so resolved entries leave gaps rather than
being renumbered.

**DOIs are out of scope at this stage.** `articles.doi` stays nullable, no `citation_doi` is
emitted, the admin form has no DOI field, and the Crossref deposit generator is not built. The
schema supports adopting DOIs later without a migration — the permanence trigger locks a DOI only
once assigned — provided article URLs never move.

## What is being built

A public website and permanent publication database for a peer-reviewed economics journal
(Economic Society of Uzbekistan). Next.js App Router + TypeScript on Vercel, Supabase for
Postgres/Storage/Auth, `next-intl` for routing.

It is **not** a manuscript management system. Peer review, decisions, and copyediting happen
off-platform. The site publishes finished work and collects proposals via a contact form.

## The two constraints that shape everything

**1. Discoverability is the reason the project exists.** Google Scholar, DOAJ, Crossref, and OAI-PMH
harvesters must see complete metadata in the server-rendered HTML. This forces:

- Static generation + ISR. **Never client-render article metadata** — a client fetch means Scholar
  sees an empty document and the journal is invisible.
- `citation_*` meta tags emitted exactly once per article page, in the article's `primary_language`,
  never one set per locale.
- `citation_pdf_url` must be direct, permanent, public, unsigned. No redirects, no expiry.
- Article and PDF URLs are permanent. Slugs are immutable after publication (DB trigger enforces
  it). PDFs are not moved when an online-first article is later assigned to an issue.

**2. Multilingual content is deliberately incomplete.** Two separate concerns that must not be
conflated:

- *UI chrome* (`next-intl` catalogues) — always complete for `en`/`uz`/`ru`.
- *Article metadata* (`article_translations`) — frequently missing a locale, and the site must
  degrade gracefully: render the page in the requested locale, fall back to `primary_language`
  content, show an inline "not yet available in [language]" notice. Never 404, never hide the
  article, never block publishing on a missing translation.

Fallback order: requested locale → `primary_language` → `en` → any available.

Uzbek is **Latin script only**. `primary_language` describes the PDF full text, not which
translations exist. The same `slug` serves all three locales; only the prefix changes.

## Data model notes worth knowing up front

- Translations live in **their own tables**, not JSONB columns — required for full-text indexing and
  for answering "which articles lack a Russian abstract?".
- Authors are **entities**, never strings. `authors.family_name`/`given_name` are the Latin canonical
  forms used for `citation_author` and Crossref; localised forms live in `author_translations`.
- `proposals` and `articles` are unrelated tables. A proposal never becomes an article via a status
  flag — an editor contacts the author offline and creates the article separately.
- `reviews` and `editorial_decisions` exist in the schema but are **unused in v1**. Create them;
  build nothing against them.
- `published_articles_localised` view resolves locale fallback in SQL — prefer it over reimplementing
  fallback in TypeScript.
- Search config per locale: `english`, `russian`, and `simple` for `uz`. Postgres ships no Uzbek
  dictionary, so `uz` gets no stemming; blend `pg_trgm` similarity into ranking for that locale.
  This is a morphology limitation, not a script one.

## Security

RLS is enabled on every table and public read is an explicit policy, not the absence of one. The
single most likely security mistake in this project is draft articles leaking to the anon key —
verify it with a test. Service-role key is server-side only. Drafts are excluded from sitemap,
OAI-PMH, and search.

## Verifying the schema

`DevelopmentPlan/verify/` applies the SQL in `SCHEMA.md` verbatim to a throwaway Postgres 16 and
asserts 26 behaviours (RLS, locale fallback, the permanence triggers, per-locale stemming). Run
`bash run.sh` from that directory after any schema change. It has been run and passes; the SQL in
`SCHEMA.md` is executed, not just written.

## Traps already found in the specs

These are documented in place, but they are the ones that cost hours if met cold:

- `array_to_string()` is STABLE, so it cannot appear in the `search_vector` generated column.
  `SCHEMA.md` → *Immutable helpers* has the wrapper.
- **RLS does not reach through a view.** Views need `with (security_invoker = true)`, and the
  anon-key draft-leak test must query the views, not only the tables.
- A 20 MB proposal upload cannot pass through a Vercel function body — the flow uses a signed
  upload URL, and `proposals` has no anonymous insert policy on purpose.
- `article_authors`' position constraint is deferrable because the author repeater reorders in one
  transaction.

## Build order

Follow it; each step is verifiable before the next begins.

0. Toolchain: Next.js + TS strict, Vitest, Playwright, CI — step 1's RLS test has to run from day one
1. Schema + migrations + seed data (incl. the Uzbek-only article and a draft article — those two
   seeds catch the bugs that matter)
2. `next-intl` routing skeleton — get locale routing right before real pages exist
3. Article page (canonical, `hreflang`, `citation_*`, JSON-LD) — verify by viewing source
4. Issue archive + homepage
5. Search
6. Supabase auth + admin publishing form
7. Proposal form → DB → Resend
8. OAI-PMH endpoint, Crossref deposit XML, sitemap
9. Design pass — **not before this point**

## Conventions

- TypeScript strict. No `any`.
- Supabase types are **generated from the schema** after every migration, never hand-written.
- Server Components by default; Client Components only for genuine interactivity (language switcher,
  search input, admin forms).
- Dates are `timestamptz`, displayed per-locale.
- `/admin` is English-only and not locale-prefixed.

## Placeholders

The journal is **Silk Road Economic Review** (short form `srer`), published by the Economic Society
of Uzbekistan.

`[UNIVERSITY]`, `[DOI_PREFIX]`, `[ISSN]`, and `[SITE_URL]` are still unresolved. Keep them as
placeholders rather than inventing values — they resolve in one typed config module
(`src/config/journal.ts`), so a real value is a single edit when it arrives. `[SITE_URL]` is the
one that blocks launch: it is open decision D2, and it gates both canonical URLs and outbound
email.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

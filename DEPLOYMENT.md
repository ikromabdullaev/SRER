# Deployment

How to get *Silk Road Economic Review* from this repository onto the public
internet, and what to check afterwards.

Written against the state of the repo at the first Vercel attempt. Every
command here has been run against the local stack; the ones marked **untested**
could not be, because they need accounts only you can create.

---

## The one thing to understand first

**The build needs a working database.**

Article pages are statically generated, because Google Scholar has to see
complete metadata in the served HTML — that is the constraint the entire
project is built around (`CLAUDE.md`, "Discoverability is the reason the
project exists"). So `generateStaticParams()` queries Supabase *while the site
is being built*, not when a visitor arrives.

Vercel's build machine therefore needs to reach a real Supabase, over the
internet, before it can produce a single page. Your database currently exists
only in Docker on your own computer, which Vercel cannot see.

That is the whole reason the deploy failed:

```
Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.
Error: Failed to collect page data for /[locale]/articles/[slug]
Error: Command "npm run build" exited with 1
```

Nothing is broken. The build refused to produce a journal with no database
behind it, which is the correct behaviour — the alternative is silently
deploying a site with no articles in it.

**So: hosted Supabase first, Vercel second.** In that order.

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com/dashboard> and sign in.
2. **New project**.
   - **Name:** anything; `srer` is fine.
   - **Region:** `Central EU (Frankfurt)` — the closest to Uzbekistan that
     Supabase offers, and the lowest latency for your readers.
   - **Database password:** generate one and **save it in a password manager
     now**. You need it in step 2 and it is not shown again.
3. Wait for provisioning (~2 minutes).

From **Project Settings → API**, you will need three values later:

| Shown as | Used as |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

The **project ref** is the subdomain of the Project URL. If the URL is
`https://abcdefghijkl.supabase.co`, the ref is `abcdefghijkl`.

---

## Step 2 — Push the schema

From this folder:

```bash
npx supabase login          # opens a browser
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies `supabase/migrations/20260820000000_initial_schema.sql`. That
one file is generated from `DevelopmentPlan/SCHEMA.md` and is the same SQL that
passes all 45 assertions in `DevelopmentPlan/verify/`. It creates:

- every table, and RLS **enabled** on all of them
- the RLS policies **and** the matching column grants (both are required; a
  policy without a grant returns `42501`)
- the permanence triggers — a published slug and `pdf_url` become immutable
- the per-locale search configuration and the search functions
- **the four storage buckets** — `articles`, `covers`, `post-images` public,
  `proposals` private — and their policies

You do **not** need to create the buckets by hand. The migration does it.

The extensions it needs (`uuid-ossp`, `pg_trgm`, `unaccent`) are all available
on hosted Supabase.

### Do not run the seed

`supabase/seed.sql` contains **invented** articles, authors and issues used to
test locale fallback and access control, plus two accounts with the password
`devpassword`. None of it is real content and none of it belongs in production
(`PRODUCT.md`, "Evidence on Hand").

`db push` does not run it. Just do not run it yourself.

Production starts empty. That is correct and expected.

---

## Step 3 — Create your real editor account

There is no public signup anywhere in this product, by design. Accounts are
provisioned by invitation.

In the Supabase dashboard: **Authentication → Users → Add user → Send
invitation** to your own address.

The `on_auth_user_created` trigger mirrors the new `auth.users` row into
`profiles` as an `editor`. To make yourself an `admin`, run this once in
**SQL Editor**:

```sql
update profiles set role = 'admin' where id = (
  select id from auth.users where email = 'you@example.org'
);
```

To publish a Weekly series you also need a handle, which is what makes a
profile publicly visible:

```sql
update profiles set handle = 'your-handle' where id = (
  select id from auth.users where email = 'you@example.org'
);
```

---

## Step 4 — Set the environment variables in Vercel

**Vercel → your project → Settings → Environment Variables.**

Add all seven. Tick **Production**, **Preview** and **Development** unless a
row says otherwise.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon public` key | Safe in the browser; RLS is what protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role secret` key | **Never** rename this with a `NEXT_PUBLIC_` prefix. It bypasses every RLS policy. Server-side only |
| `NEXT_PUBLIC_SITE_URL` | your public origin, **no trailing slash** | See the warning below |
| `EDITORIAL_EMAIL` | `silkroadeconomicreview@gmail.com` | Receives proposals; published in the OAI-PMH `Identify` record |
| `RESEND_API_KEY` | your Resend key | Rotate the old one first — it was pasted into a chat transcript |
| `RESEND_FROM` | **leave empty for now** | See "Email" below |

### ⚠️ `NEXT_PUBLIC_SITE_URL` is a permanent decision

This value is baked at **build time** into:

- every `<link rel="canonical">`
- every `citation_pdf_url` that Google Scholar follows
- every `hreflang` alternate
- every URL in `sitemap.xml`
- every OAI-PMH record identifier (`oai:<host>:<slug>`)

This is open decision **D2** in `SPEC.md`, and it is the one that blocks
launch. Article URLs are promises: `PRODUCT.md` principle 4 is "Permanence
outranks improvement."

Setting it to `srer.vercel.app` to get a green build is fine for a throwaway
test. It is **not** fine for anything you let Google Scholar or DOAJ see,
because those URLs then become the ones the world cites. Get the real domain
before you submit the site anywhere.

### Indexing is gated on this value

While `NEXT_PUBLIC_SITE_URL` points at a `*.vercel.app` host or localhost, the
site tells every crawler to stay out:

- `robots.txt` serves `Disallow: /` and advertises no sitemap
- every response carries `X-Robots-Tag: noindex, nofollow`, which also covers
  `sitemap.xml` and the OAI-PMH endpoint — neither is HTML, so neither can
  carry a meta tag

This is deliberate. `robots.txt` asks a crawler not to *fetch*; the header
tells it not to *index*, and only the second survives a page being linked from
somewhere else. A URL Google Scholar has taken cannot be withdrawn, and one
pointing at a host you are going to abandon would enter the scholarly record
permanently.

Set a real domain and both switch off by themselves. Nothing else changes, and
no article is ever `noindex` on the journal's own domain.

Verify after any change of origin:

```bash
curl -s https://<site>/robots.txt
curl -sI https://<site>/en | grep -i x-robots-tag    # expect nothing on the real domain
```

### Email

`RESEND_FROM` is deliberately unset. Resend refuses `gmail.com` as a sending
domain, and `onboarding@resend.dev` only delivers to the account owner. With it
empty, `src/lib/email.ts` returns `{ sent: false, reason }` instead of throwing
— so **a proposal is still recorded in the database**, the submitter still sees
the acknowledgement, and only the notification email is skipped.

Once you own a domain and verify it at <https://resend.com/domains>, set
`RESEND_FROM=editorial@yourdomain` and email starts working with no code
change.

---

## Step 5 — Deploy

Vercel is already connected to <https://github.com/ikromabdullaev/SRER>.
Push to `main`, or hit **Redeploy** on the failed deployment.

Framework preset, build command and output directory are all detected
correctly; nothing needs to be configured by hand.

---

## Step 6 — Verify the deployment

Replace `<site>` with your domain. All of these were checked against the local
production build and pass there.

### It is alive

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<site>/en
curl -s -o /dev/null -w "%{http_code}\n" https://<site>/uz
curl -s -o /dev/null -w "%{http_code}\n" https://<site>/ru
curl -s -o /dev/null -w "%{http_code}\n" https://<site>/          # expect 308
```

### The machine-readable surfaces

```bash
curl -s https://<site>/robots.txt
curl -s https://<site>/sitemap.xml | head -20
curl -s "https://<site>/api/oai?verb=Identify"
```

In the sitemap, check that `<loc>` carries **your domain** — not
`localhost`, not a `vercel.app` preview host.

### The security check that matters most

Drafts must never be visible to the anonymous key. With an empty database
there is nothing to check yet, but once you have a draft article:

```bash
curl -s https://<site>/sitemap.xml | grep <draft-slug>          # expect nothing
curl -s "https://<site>/api/oai?verb=ListRecords&metadataPrefix=oai_dc" \
  | grep <draft-slug>                                            # expect nothing
curl -s -o /dev/null -w "%{http_code}\n" https://<site>/en/articles/<draft-slug>
                                                                 # expect 404
```

### Admin

```
https://<site>/admin/login
```

Sign in with the account from step 3. `/admin` must redirect to `/admin/login`
when signed out.

### Once a real article is published

View source on its page and confirm:

- `citation_*` tags appear **once**, on the article's primary-language page
  only — not on all three locales
- `citation_pdf_url` is a direct, public, unsigned link that resolves
- no `[ISSN]`, `[UNIVERSITY]` or other `[PLACEHOLDER]` appears anywhere

---

## Troubleshooting

### `NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set`

The variables are not set in Vercel, or not enabled for the environment being
built. Step 4. Redeploy after adding them — Vercel does not re-read them on an
existing build.

### `Failed to collect page data for /[locale]/articles/[slug]`

The build could not reach the database. Either the variables are missing (see
above), or `NEXT_PUBLIC_SUPABASE_URL` points at `127.0.0.1` / `localhost`,
which on Vercel means Vercel's own machine.

### `permission denied for table ...` (Postgres `42501`)

A policy exists without a matching grant, or vice versa. Both are required.
This bit us once already, on `profiles.role`. Re-run `npx supabase db push`
and confirm the migration applied fully.

### The site builds but shows no articles

Correct, if the database is empty. Publish one through `/admin`.

### An article is published but its page 404s

Published articles are prerendered at build time. Vercel rebuilds on push, not
on database change — so a newly published article appears after the next
deployment, or after its ISR window elapses. Redeploy to force it.

---

## Still unresolved before this is a real launch

None of these are code problems. All are decisions or facts only you can
supply.

- **D2 — the public domain.** Blocks canonical URLs, `citation_pdf_url` and
  outbound email. The single most consequential item here.
- **ISSN** — pending from the National Library of Uzbekistan. Until it exists,
  `citation_issn` is correctly omitted rather than emitted as a placeholder.
- **The editorial board** — `content/*/editorial-board.md` is deliberately
  empty. DOAJ reads it closely.
- **The peer review model** — single-anonymous, double-anonymous or open. DOAJ
  requires it stated explicitly, and it must describe what actually happens.
- **An archiving arrangement** — DOAJ asks how articles survive the site
  disappearing. Until one exists the policy page must say so plainly.
- **`[UNIVERSITY]`** — the partner institution named throughout the specs.

`PRODUCT.md` records why none of these may be invented: with nothing published,
the journal's credibility rests on being accurate about what it is.

---

## Security notes

- `.env.local` is gitignored and has **never** been committed. The repository
  and all 20 commits were scanned for Resend keys, JWTs, AWS keys, private key
  blocks and connection strings: clean.
- Never commit `.env.local`, and never zip this folder to deploy it — a zip
  ignores `.gitignore` and would carry your service-role key.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It is read only by
  `src/app/[locale]/submit/actions.ts` and `src/app/admin/proposals/actions.ts`,
  both server-side.
- The public pages deliberately use the **anon** key, so RLS is what keeps
  drafts invisible. That is a feature, not an oversight.
- **Rotate the Resend key** at <https://resend.com/api-keys>. It is not in the
  repository, but it was pasted into a chat transcript.

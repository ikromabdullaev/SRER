# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: researchers and graduate students in Central Asia and the Caucasus.**
They arrive to read a specific article, to check whether the journal is
somewhere they would submit, or to follow a citation. Many will read in Russian
or Uzbek rather than English, so those languages carry real weight and are not
courtesy translations.

**Secondary: policymakers and institutional readers** — ministries, central
banks, development banks, and their analysts. They arrive for evidence about
the region rather than for citations. Academic legitimacy is the foundation of
the journal's credibility with them, but the work has to remain legible to
someone who is not an academic economist.

**Third: the editors themselves.** Two to a handful of staff who publish
everything through `/admin`. They are not the audience the public site serves,
but they are the people who use the software most, and the publishing form is
the surface they live in.

**Not users:** peer reviewers and manuscript authors mid-review. All editorial
work happens off-platform; the site publishes finished work and collects
proposals.

## Product Purpose

*Silk Road Economic Review* is a peer-reviewed, open-access economics journal
published by the Economic Society of Uzbekistan. The site is its public face
and its permanent scholarly record.

Its focus is the economies of Central Asia and the Caucasus: work on the
region, work using data from the region, and comparative research that places
it in a wider context.

Success is not traffic. Success is that an article published here is **found**
— indexed by Google Scholar, listed in DOAJ, harvested by regional
aggregators — and that a researcher deciding where to send a paper concludes
this is a real journal.

## Positioning

Two things a neighbouring journal could not truthfully copy:

1. **A regional record kept in the region's own languages.** Article metadata
   is stored per-locale in English, Uzbek (Latin script) and Russian, and the
   site is built to publish an article that exists in only one of them. Most
   journals covering this region publish in English only; those that do not are
   usually invisible to Scholar. This one is designed to be both multilingual
   and indexed.

2. **Open access with no fees in either direction.** Free to read and free to
   publish. For researchers in the region, article processing charges at
   international journals are frequently the binding constraint, not quality.

## Operating Context

- **The article of record is a PDF.** The site publishes metadata and hosts the
  file; it does not render article full text as HTML. Readers download and
  cite the PDF.
- **The Weekly series is the opposite**: editorial commentary written or pasted
  directly into the site by a named editor, where the text *is* the record.
  Each editor has their own series at `/weekly/{handle}/{slug}`.
- **Editorial workflow is off-platform.** Review, decisions and copyediting
  happen by email. A proposal arrives through the site, an editor reads it and
  contacts the researcher directly; nothing turns a proposal into an article
  automatically.
- **Machines read this site before people do.** Google Scholar, DOAJ and
  OAI-PMH harvesters parse the server-rendered HTML. Their requirements are
  not a feature of the site — they are its operating environment.
- **Issues and online-first coexist.** An article may be published with a
  permanent URL before it belongs to any issue, and is not moved when one is
  assigned.

## Capabilities and Constraints

**Confirmed and built:**

- Three locales: `en`, `uz`, `ru`. Uzbek is **Latin script only**; no Cyrillic
  Uzbek is stored or accepted.
- Article metadata is deliberately incomplete per locale and degrades
  gracefully: requested locale → the PDF's language → English → any available,
  resolved per field, always with a visible notice. An article never hides.
- Weekly posts behave the opposite way on purpose: a post exists only in the
  languages it was written in. A language filter removes it rather than
  translating it.
- Articles and Weekly posts are never mixed in one search result list.
- Two content types, two discoverability treatments: articles carry Scholar
  `citation_*` tags and appear in OAI-PMH; Weekly posts carry neither, because
  claiming peer-reviewed status for editorial commentary would damage the
  journal's standing with DOAJ.
- **URLs and PDFs are permanent.** Slugs are immutable once published, enforced
  by a database trigger. Corrections are new records, not silent edits.
- Licence: CC BY 4.0. No submission or publication fees.
- Admin is English-only, invite-only, and not locale-prefixed. There is no
  public signup anywhere in the product.

**Undecided, recorded rather than invented:**

- **Public domain name** — nothing is registered. This blocks launch: it is
  baked into every canonical URL, the PDF links Scholar follows, and it is also
  what outbound email needs before Resend will send anything.
- **ISSN** — not yet issued by the National Library of Uzbekistan.
- **Partner university** — referred to throughout the specs as `[UNIVERSITY]`.
- **DOIs are explicitly out of scope** at this stage. The schema supports
  adopting them later without a migration, provided article URLs never move.
- **What a withdrawn article does** (tombstone versus removal) is unresolved,
  and the OAI-PMH deletion policy currently declares that no deletion
  information is maintained.
- **The peer review model is not settled** — single-anonymous, double-anonymous
  or open. DOAJ requires it stated explicitly and it must describe what
  actually happens, so it cannot be inferred from convention.
- **No archiving arrangement exists.** DOAJ asks how articles survive the site
  disappearing. Until one is in place the policy page must say so plainly
  rather than implying preservation that is not happening.

## Brand Commitments

- **Name:** *Silk Road Economic Review*. Short form `srer`.
- **Identity is a wordmark only** — no symbol or emblem. The name set as type
  carries the identity.
- **Publisher:** Economic Society of Uzbekistan, in collaboration with
  `[UNIVERSITY]`.
- **Editorial address:** silkroadeconomicreview@gmail.com. It receives
  proposals and is published in the OAI-PMH record; it cannot be the *sender*
  address, because Gmail cannot be a verified sending domain.

No logo artwork, no colour system, no typographic specification, and no prior
visual material of any kind exists. `public/` currently contains only Next.js
scaffold SVGs, which are not assets.

## Evidence on Hand

**There is none, and this is the central fact about the launch.**

- **No published articles.** Zero. The database contains seed fixtures with
  invented titles and authors used to test locale fallback and access control.
  They are not content and must never be presented as such.
- **No editorial board.** Names and affiliations are still being assembled.
  It will be small — fewer than ten people — so each member can be presented
  properly rather than compressed into a directory row.
- **No policy pages.** Aims and scope, peer review policy, publication ethics,
  archiving, authorship and conflict of interest are all unwritten. DOAJ reads
  these closely, and the navigation currently links to routes that do not exist.
  Drafts may be written for the editors to approve, but two sections cannot be
  drafted at all until the decisions above are made: the review model and the
  archiving arrangement. Those must read as pending, never as settled.
- **No institutional endorsements, metrics, indexing badges, or press.**

Future work must not fabricate any of this. No invented article counts, no
placeholder board members, no "indexed by" claims, no fictional testimonials
from researchers. The honest position at launch is a journal stating clearly
what it is and what it will publish.

## Product Principles

1. **Being found is the product.** Every decision defers to server-rendered,
   machine-readable metadata. A choice that makes the site prettier and the
   record less legible to Google Scholar is the wrong choice.

2. **Credibility has to be built before the record exists.** With nothing
   published, trust comes from clarity of scope, named people, stated policies,
   and evident care — not from claims. The site must read as a serious journal
   to a researcher deciding where to send their work, while being honest that
   it is new.

3. **Incompleteness is a normal state, not a defect.** A missing translation, an
   article with no issue, an author with no ORCID: these are expected and must
   be presented as ordinary rather than broken or apologetic.

4. **Permanence outranks improvement.** A URL, a slug and a PDF path are
   promises. Nothing that has been published moves, and no redesign may break a
   link a citation depends on.

5. **The region is the subject, not a decoration.** The journal's focus is
   Central Asia and the Caucasus, and its languages are part of its substance.
   Neither should be reduced to ornament.

## Accessibility & Inclusion

No formal standard has been committed to. What is established and must be
respected:

- **Three languages across two scripts**, Latin and Cyrillic. Any typographic
  decision has to serve Cyrillic properly, not treat it as a fallback.
- **A page may legitimately mix languages** — a Russian interface around an
  Uzbek abstract — so language must be marked in the markup, per element, for
  screen readers and for translation tools.
- **Readers are on varied connections and devices**, including older hardware.
  The PDF is the artifact people come for; nothing should stand between a
  reader and that file.

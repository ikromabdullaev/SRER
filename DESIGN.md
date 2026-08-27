# Design

The visual world of *Silk Road Economic Review*, written from the built result.
`PRODUCT.md` owns product truth; this file owns durable visual decisions.

## The direction

**The Nauka Setting.** The journal is set in the scientific-publishing
tradition its readership was actually trained on — the austere, systematic
typography of Academy and Nauka-imprint volumes — rather than in the
broadsheet-editorial idiom (serif display, hairline rules, cream ground) that
every journal in this category ships.

Chosen by the user against a dealt roll, seed `6aaea64e`. The direction
contract is emitted as an HTML comment in `src/app/[locale]/layout.tsx` and
survives into the production build, where `grep 6aaea64e .next` finds it.

Three rules govern everything:

1. **Rules are structure.** A horizontal rule marks a real boundary — a
   section, a record, a field group. There is no rule anywhere for texture.
   A list's last row therefore carries no rule, because the next section's own
   rule already states that boundary; two rules a few pixels apart say the same
   thing twice.
2. **Numerals are the spine.** Volumes, issues, pages, dates and JEL codes are
   always tabular. In a statistical publication numbers align down a column or
   they are decoration.
3. **Colour owns fields, never accents.** The masthead is a red field; the
   submit band is a red field. Red is not sprinkled over a neutral ground.

**There are no cards anywhere.** The record is a ruled list, dense on purpose:
a journal with four articles shows four articles properly rather than padding
them into tiles to look busier than it is.

### Raises carried from the challengers this direction beat

Each was donated by a rejected catalogue world, and each is a discipline rather
than a borrowed motif:

- **Every element owns exactly one fact** — nothing decorative carries no
  information *(from the night-flight instrument panel)*
- **One structural grid, no local exceptions** *(from the ASCII glyph field)*
- **Colour owns whole fields at page scale** *(from the rain-night nocturne)*
- **The active state is unmistakable, never a tint** *(from the torn-shard menu)*
- **Density courage: present a thin record densely** *(from the angura poster)*

## Palette

Light, and not by category habit. The use scene decided it: a researcher at a
university desk mid-morning on a mid-range laptop with a window behind them, or
on a phone in the metro. That is a daylight, dense-text, glare-prone scene.

| Token | Value | Role | Contrast on paper |
|---|---|---|---|
| `--paper` | `#f1f2ee` | Ground. Cool offset stock, deliberately **not cream** — a working publication, not a keepsake. | — |
| `--paper-raised` | `#f8f9f6` | Input and editor surfaces | — |
| `--ink` | `#15181b` | Body text, structural rules | 15.85:1 |
| `--ink-2` | `#4a5058` | Secondary text | 7.24:1 |
| `--ink-3` | `#656b74` | Labels, dates, placeholders | 4.78:1 |
| `--red` | `#aa1a14` | **The committed colour.** Masthead, submit band, active state, links. | 6.51:1 |
| `--red-deep` | `#7c120e` | Hover and pressed on red | — |
| `--red-wash` | `#f4e6e4` | Notices — tinted from the hue, never grey | — |
| `--rule` | `#cbcdc5` | Minor structural rules | — |
| `--rule-control` | `#868a83` | The edge of a form control | 3.32:1 on raised |
| `--focus` | `#0f5fa8` | Focus ring, deliberately outside the palette so it never reads as decoration | — |

Colour strategy is **Committed**: one saturated colour carrying whole regions.
`--ink-3` was measured at 4.13:1 in its first form and darkened until it cleared
4.5:1, because it carries dates, field labels and placeholder text.

`--rule-control` exists for the same reason. `--rule` is a hairline between
rows and sits at 1.5:1 on paper — correct for a row separator, and a WCAG
1.4.11 failure as the boundary of something you are meant to click into.
Same hue, darkened until it clears 3:1 on both grounds.

## Type

**PT Serif** for reading, **Golos Text** for structure — masthead, headings,
labels, numerals, controls. Both from ParaType, both drawn Cyrillic-first.

This is the single most on-brief decision in the system. PT was commissioned
under the *Public Types of the Russian Federation* programme: a type family
made for the languages of this region rather than an Anglo-American face with
Cyrillic added afterwards. The brief was "genuinely ours, not a Western
template with Russian bolted on," and the typeface is where that either
becomes true or stays a claim.

### Why the fonts are self-hosted

Not a preference. **Uzbek Latin writes `oʻ` and `gʻ` with a modifier letter,
U+02BB or U+02BC, and both fall inside a gap in every Google Fonts subset**,
whose latin-ext range runs `U+0100-02BA, U+02BD-02C5`. Served from Google,
Uzbek's two distinctive letters arrive from whatever system font the browser
reaches for — a different shape and weight sitting inside the word, on the
language this journal is least entitled to treat as an afterthought.

Measured against the actual font binaries: **neither face ships U+02BB; both
ship U+02BC.** All content therefore uses **U+02BC**. If the editors want
strict U+02BB the fonts must be patched — a deliberate decision, not something
to discover in production.

Subset to Latin + Latin Extended-A + Cyrillic + the punctuation this journal
sets: **1.26 MB of TTF down to 164 KB of woff2**, in `src/fonts/`.

### Scale

Headings are Golos at `-0.015em` tracking; the wordmark at `-0.028em`. Body is
PT Serif at 1.0625rem/1.62 on a 34rem measure. Section labels are 0.8125rem
uppercase at `0.1em`. Display tops out below the 6rem ceiling.

## Composition

- **Masthead**: a red field carrying the wordmark knocked out to paper, with
  the language triad and the publisher's name. Navigation sits below it on
  paper, so the field reads as a nameplate rather than a coloured strip.
- **Homepage**, in the order the editors specified: welcome, this week's
  Weekly, what the journal is, recently published, submit. Weekly sits above
  the record because it is what changes; the record is what readers arrive
  looking for and is reachable from anywhere.
- **Article page**: a reading column at the measure beside a facts column where
  every row is exactly one fact — type, issue, pages, date, JEL, licence.
  Capped at 60rem and centred, so leftover space is symmetric margin rather
  than a lopsided void.
- **Prose pages**: single column at the measure. Comprehension first. The
  heading takes the same rule the page head does, at the measure rather than
  at page width.

### The page head

Every interior page used to open with a bare `h1` at roughly body scale and a
paragraph under it, while the homepage opened at 3.9rem on a red field. That is
the system opting out of its own strongest move on eight of ten routes, and it
is the reason the site read as simple.

A page opening is now the same device a section opening is, at page scale: the
heading carried on the 2px ink rule, at the size the subject deserves, with a
lede beside it and **one** fact hung on the rule — result count, issue year.
Deliberately not a display metric: a large numeral over a small label is a
template, not information, and the fact slot stays empty on pages that have no
honest number to put in it.

Anything that opens with its own 2px rule gets `--s7` of clearance below the
page head. Two ink rules a screen-inch apart state the same boundary twice.

### The head as a field

`/submit` is the one interior page that spends the masthead's colour. The
homepage closes with a red band promising this page, so following that band
should land the reader *inside* that field rather than on a plain page with a
form on it. It is also the only page asking a stranger for something, and the
terms of that ask — no fees in either direction — are set on a rule inside the
field rather than buried in a paragraph under the form.

No other interior page gets a field. If they all did, the masthead would stop
being a nameplate.

## Forms

A form here is a record being written, not a stack of boxes — so it uses the
ruled rows the archive already uses: label in Golos on the left, control on the
right, one rule per field, the whole thing opened by the same 2px ink rule.

**The writing line.** Every control carries a 2px `--ink-3` edge along its foot
inside a 1px `--rule-control` box. That foot turns `--red` while the field is
active, which makes the focused field a *state* rather than a tint, and spends
the committed colour on exactly one row at a time. Hover darkens the foot to
ink and lifts the ground from `--paper-raised` to `--paper`.

**The caret is drawn.** `appearance: none` plus an inline SVG chevron at the
same stroke weight as the rules around it. The browser's own select arrow
belongs to no design system, and a Unicode glyph standing in for one is a
costume.

**The attachment** is the only control on the form that is not a line of text,
so it is the only one that is a field. It draws three states — waiting, sending,
attached — rather than shipping the operating system's file button in the middle
of the page. The native input is kept full-size at zero opacity over the block,
so dragging a file anywhere onto it works and so does the keyboard, and the
wrapping label carries the field's own name for screen readers alongside the
visible action. Attached, the file becomes a record row like every other record
here: name, tabular size, and a way to remove it.

**Errors are placed where the mistake is.** A rejected file reports inside the
attachment field; everything else reports above the action. An error owns its
block — red wash under a 2px red rule — the way colour owns fields everywhere
else here, rather than tinting a border and hoping to be noticed.

**The acknowledgement replaces the form.** Sending a proposal is the one moment
a stranger commits something to this journal. Leaving a filled-in form on screen
underneath a line of green text invites them to send it twice.

Admin inherits the same control language at tighter density and spends none of
the drama, per the Admin section below.

## The language triad

The three languages are a permanent visible triad in the masthead, not a
dropdown. Which languages this journal publishes in is a fact about the
journal. The current one is knocked through to paper — an unmistakable state.

They are real links, so a crawler can follow them; a `<select>` is invisible
to one.

**Language registers** (`EN OʻZ РУ`, present marked, absent struck through)
appear wherever a thing's language availability is information — Weekly cards
especially, where a post exists *only* in the languages it was written in.

## Motion

**One authored moment**: the language triad settles on first paint, staggered
60ms, exponential ease-out from a visible default. Everything else is state
feedback. Fully disabled under `prefers-reduced-motion`.

## Browser surfaces

Themed from the palette rather than left to the browser: text selection (red
field, paper text), focus ring, scrollbar track and thumb, placeholder colour,
link underline offset and thickness, and tabular numerals throughout.

## Admin

Operate mode, in `src/app/admin/admin.css`. It inherits the palette and type
and spends none of the masthead's drama: a red field behind a publishing form
would be decoration where every pixel should carry a control. Brand appears in
precise details — the same rule structure, tabular numerals, and red reserved
for the active state and the primary action.

## Refused

Named so they do not creep back:

- Cards as page structure; nested cards
- Eyebrows or kickers above headings — the article type was one for an hour and
  became a fact row instead
- Cream ground with high-contrast display serif — the category's default
  wearing this subject's clothes
- Silk Road ornament: tile pattern, caravans, maps as wallpaper. The region is
  the subject, not the decoration
- Gradient text, glass, decorative blur
- Coloured `border-left` above 1px
- Monospace as a costume for "technical"
- Emoji or Unicode glyphs standing in for icons

## Known gaps

- **Mobile rendering has not been visually verified.** The inspection browser
  reports `innerWidth: 1920` regardless of window size, so no narrow viewport
  could be rendered. What *was* verified statically: both breakpoints present
  (`60rem`, `40rem`), no fixed widths above 320px, no oversized `min-width`.
  This needs a real device or a browser that reflows before launch.
- **The amplification pass was verified statically, not visually.** Chrome
  could not reach `localhost` from this machine — the extension loads external
  sites but returns "This page couldn't load" for `localhost` and `127.0.0.1`,
  so no screenshot of the new page heads, the submit field or the form could be
  taken. What *was* verified: every new colour pair measured against the 4.5:1
  and 3:1 floors (24 pairs, no failures), the mechanical detector clean, the
  production build green, and the rendered HTML checked for each new device on
  each route. The composition itself — in particular the red masthead, paper
  nav, red submit field sequence — has not been seen.
- No logo artwork exists; the identity is the wordmark set in Golos Text.
- Editorial board page is deliberately empty pending real names.

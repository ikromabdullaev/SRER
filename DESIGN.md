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
| `--focus` | `#0f5fa8` | Focus ring, deliberately outside the palette so it never reads as decoration | — |

Colour strategy is **Committed**: one saturated colour carrying whole regions.
`--ink-3` was measured at 4.13:1 in its first form and darkened until it cleared
4.5:1, because it carries dates, field labels and placeholder text.

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
- **Prose pages**: single column at the measure. Comprehension first.

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
- No logo artwork exists; the identity is the wordmark set in Golos Text.
- Editorial board page is deliberately empty pending real names.

import localFont from "next/font/local";

/**
 * Self-hosted, and not by preference.
 *
 * Uzbek Latin writes `oʻ` and `gʻ` with a modifier letter — U+02BB (turned
 * comma) or U+02BC (apostrophe). **Both fall inside a gap in Google Fonts'
 * subsets**, whose latin-ext range runs `U+0100-02BA, U+02BD-02C5`. Loading
 * these faces from Google therefore renders Uzbek's two distinctive letters
 * from whatever system font the browser reaches for: a different shape and
 * weight sitting inside the word, on the language this journal is least
 * entitled to treat as an afterthought.
 *
 * Measured: neither face ships U+02BB; both ship U+02BC. Content uses U+02BC.
 * If the editors want strict U+02BB the fonts need patching, and that is a
 * deliberate choice rather than something to discover in production.
 *
 * Subset to Latin + Latin Extended-A + Cyrillic + the punctuation this journal
 * actually sets: 1.26 MB of TTF down to 164 KB of woff2.
 */

/** Reading face. ParaType, drawn for the languages of this region. */
export const ptSerif = localFont({
  src: [
    { path: "./PT_Serif-Web-Regular.woff2", weight: "400", style: "normal" },
    { path: "./PT_Serif-Web-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
  // Matched against Georgia's metrics so the swap does not reflow the page.
  fallback: ["Georgia", "Times New Roman", "serif"],
});

/** Structural face: masthead, labels, numerals, controls. */
export const golos = localFont({
  src: [{ path: "./GolosText.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

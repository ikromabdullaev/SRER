import { defineRouting } from "next-intl/routing";

/**
 * Locale routing.
 *
 * SPEC.md §4.2 and §4.4:
 *  - `uz` is Latin script only. No Cyrillic Uzbek content is stored or accepted.
 *  - Every locale is prefixed, and `/` redirects to `/en/` with a plain 308.
 *
 * `localeDetection: false` is deliberate and contradicts the next-intl default.
 * The library negotiates `Accept-Language` unless told not to; SPEC.md §4.4
 * wants a predictable redirect instead, because a crawler that gets a different
 * page depending on its headers is a crawler that indexes the wrong thing.
 */
export const routing = defineRouting({
  locales: ["en", "uz", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  // U+02BC, not the ASCII apostrophe. Uzbek Latin writes this letter with a
  // modifier letter, and it is the reason the fonts are self-hosted at all
  // (DESIGN.md, "Why the fonts are self-hosted"). A straight quote here
  // renders in whatever fallback the browser reaches for, inside the one
  // word naming the language.
  uz: "Oʼzbekcha",
  ru: "Русский",
};

/**
 * BCP 47 tags for `lang` attributes and `hreflang`.
 * Uzbek is pinned to Latin script.
 */
export const localeHtmlLang: Record<Locale, string> = {
  en: "en",
  uz: "uz-Latn",
  ru: "ru",
};

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

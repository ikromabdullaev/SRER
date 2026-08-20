"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/** Short forms. The journal's own languages, named in themselves. */
const SHORT: Record<Locale, string> = { en: "EN", uz: "OʻZ", ru: "РУ" };
const FULL: Record<Locale, string> = {
  en: "English",
  uz: "Oʻzbekcha",
  ru: "Русский",
};

/**
 * The language triad.
 *
 * Not a dropdown. Which three languages this journal publishes in is a fact
 * about the journal, so all three stay visible and the current one is knocked
 * through to paper — an unmistakable state rather than a tint.
 *
 * They are real links, which also means a crawler can follow them; a select
 * element is invisible to one.
 *
 * `OʻZ` is set with U+02BC, which is why the faces are self-hosted: every
 * Google Fonts subset omits it, and the letter would otherwise arrive from
 * some other font entirely.
 */
export function LanguageTriad({ current }: { current: Locale }) {
  const pathname = usePathname();

  return (
    <nav className="langs" aria-label="Language">
      {routing.locales.map((locale) =>
        locale === current ? (
          <span key={locale} aria-current="true" lang={locale}>
            <span className="visually-hidden">{FULL[locale]} — </span>
            {SHORT[locale]}
          </span>
        ) : (
          <Link key={locale} href={pathname} locale={locale} lang={locale}>
            <span className="visually-hidden">{FULL[locale]}</span>
            <span aria-hidden="true">{SHORT[locale]}</span>
          </Link>
        ),
      )}
    </nav>
  );
}

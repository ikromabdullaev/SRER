import { routing, type Locale } from "@/i18n/routing";

const SHORT: Record<Locale, string> = { en: "EN", uz: "OʻZ", ru: "РУ" };

/**
 * Which languages a thing exists in.
 *
 * For this journal that is information, not decoration: a Weekly post exists
 * only in the languages it was written in, so a reader filtering to Russian
 * needs to know before they click. Present languages are marked; absent ones
 * are shown struck-through rather than omitted, so the set is always the same
 * width and the gap is legible at a glance.
 */
export function Registers({ locales }: { locales: Locale[] }) {
  return (
    <span className="registers">
      <span className="visually-hidden">Available in: </span>
      {routing.locales.map((locale, i) => {
        const present = locales.includes(locale);
        return (
          <span key={locale}>
            {i > 0 && " "}
            {present ? <b>{SHORT[locale]}</b> : <s aria-hidden="true">{SHORT[locale]}</s>}
          </span>
        );
      })}
    </span>
  );
}

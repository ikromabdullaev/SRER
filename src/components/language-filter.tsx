"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";

/**
 * Filters the Weekly listing by the language a post was written in.
 *
 * This is not the site language switcher. Changing this does not translate the
 * page — it narrows the list to posts that exist in the chosen language, and
 * removes the ones that do not.
 */
export function LanguageFilter({
  current,
  label,
  allLabel,
}: {
  current: Locale | null;
  label: string;
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="language-filter">
      <span>{label}: </span>
      <select
        value={current ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          router.replace(value ? `${pathname}?lang=${value}` : pathname);
        }}
      >
        <option value="">{allLabel}</option>
        {routing.locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}

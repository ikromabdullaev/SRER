"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";

/**
 * One of the few genuine Client Components in this project (SPEC.md §11).
 *
 * Switching locale keeps the current path: the slug is identical across all
 * three locales and only the prefix changes (§4.4), so a reader on an article
 * stays on that article rather than being dropped on the homepage.
 */
export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const router = useRouter();
  // next-intl's usePathname returns the path without the locale prefix and
  // with dynamic segments already substituted, so the same path is valid for
  // every locale -- which is exactly SPEC.md §4.4's rule that the slug is
  // identical across locales and only the prefix changes.
  const pathname = usePathname();

  function onChange(next: string) {
    router.replace(pathname, { locale: next as Locale });
  }

  return (
    <label className="language-switcher">
      <span className="visually-hidden">{label}</span>
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
      >
        {routing.locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}

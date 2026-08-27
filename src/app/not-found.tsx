import { getTranslations } from "next-intl/server";
import { routing, localeHtmlLang, localeNames, type Locale } from "@/i18n/routing";
import { journal } from "@/config/journal";
import { ptSerif, golos } from "@/fonts";
import "./globals.css";

/**
 * The 404 for the whole application.
 *
 * Next resolves a missing route above the `[locale]` segment — a slug that is
 * not in `generateStaticParams` never enters it — so this file, not
 * `[locale]/not-found.tsx`, answers the great majority of 404s. It therefore
 * has to be a real page rather than a fallback.
 *
 * It renders its own `<html>` and `<body>` because the root layout is a
 * pass-through: `[locale]/layout.tsx` owns the document everywhere else, and a
 * missing route is by definition outside it. Without that, Next serves an
 * unstyled page belonging to no design system.
 *
 * This page matters more here than on most sites. A journal's promise is that
 * a citation printed in 2026 still resolves in 2036, so the people most likely
 * to land here are exactly the ones that promise was made to. The copy says
 * the one true and useful thing instead of apologising: addresses here never
 * change, so a citation that does not open is a typo or was never published.
 *
 * There is no language to infer from an address that failed to match, so all
 * three are offered. English carries the heading because it is the default
 * locale — the same choice `/` and `/admin` already make.
 */
export const metadata = {
  title: `Page not found — ${journal.name}`,
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: "notFound",
  });

  return (
    <html
      lang={localeHtmlLang[routing.defaultLocale]}
      className={`${ptSerif.variable} ${golos.variable}`}
    >
      <body>
        <header className="masthead">
          <div className="masthead__inner">
            <div>
              <a href={`/${routing.defaultLocale}`} className="wordmark">
                <span className="wordmark__rule" aria-hidden="true" />
                {journal.name}
              </a>
            </div>
            <p className="masthead__meta">{journal.publisher}</p>
          </div>
        </header>

        <main id="content" className="shell">
          <div className="page-head">
            <div>
              <h1>{t("title")}</h1>
              <p className="page-head__lede">{t("lede")}</p>
            </div>
            {/* The status is a fact about this page, set like every other. */}
            <p className="page-head__fact">404</p>
          </div>

          <div className="not-found">
            <p className="not-found__note">{t("permanence")}</p>

            <ul className="not-found__ways">
              <li>
                <a href={`/${routing.defaultLocale}/search`}>{t("search")}</a>
              </li>
              <li>
                <a href={`/${routing.defaultLocale}/issues`}>{t("issues")}</a>
              </li>
            </ul>

            {/* Which languages this journal publishes in is a fact about the
                journal, and the address gave no clue which one was wanted. */}
            <ul className="not-found__ways not-found__ways--languages">
              {routing.locales.map((locale) => (
                <li key={locale}>
                  <a href={`/${locale}`} lang={localeHtmlLang[locale as Locale]}>
                    {localeNames[locale as Locale]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </body>
    </html>
  );
}

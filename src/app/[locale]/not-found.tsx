import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * The 404 inside the localised site.
 *
 * This page matters more here than it does on most sites. A journal's whole
 * promise is that a citation printed in 2026 still resolves in 2036, so the
 * people most likely to land here are the ones that promise was made to:
 * someone following a reference that did not work. Handing them Next's bare
 * default — no masthead, no language, no way onward — is the least
 * appropriate possible answer.
 *
 * The copy says the one true and useful thing rather than apologising:
 * addresses here never change, so a broken citation is a typo or was never
 * published, and neither is worth hunting for by hand. Then it offers search.
 *
 * It renders inside `[locale]/layout.tsx`, so it arrives with the masthead,
 * the language triad and the footer already around it.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="shell">
      <div className="page-head">
        <div>
          <h1>{t("title")}</h1>
          <p className="page-head__lede">{t("lede")}</p>
        </div>
        {/* The status is a fact about this page, set like every other fact. */}
        <p className="page-head__fact">404</p>
      </div>

      <div className="not-found">
        <p className="not-found__note">{t("permanence")}</p>

        <ul className="not-found__ways">
          <li>
            <Link href="/search">{t("search")}</Link>
          </li>
          <li>
            <Link href="/issues">{t("issues")}</Link>
          </li>
          <li>
            <Link href="/">{t("home")}</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

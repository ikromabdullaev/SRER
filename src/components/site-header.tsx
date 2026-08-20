import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LanguageTriad } from "./language-triad";
import { journal } from "@/config/journal";

/**
 * The masthead is a red field, not a red accent: colour owns the region.
 * Navigation sits below it on paper, so the field reads as the journal's
 * nameplate rather than as a coloured strip decorating a header.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");

  return (
    <>
      <a className="skip-link" href="#content">
        {t("skipToContent")}
      </a>

      <header className="masthead">
        <div className="masthead__inner">
          <div>
            <Link href="/" className="wordmark">
              <span className="wordmark__rule" aria-hidden="true" />
              {journal.name}
            </Link>
          </div>
          <div>
            <LanguageTriad current={locale} />
            <p className="masthead__meta">{journal.publisher}</p>
          </div>
        </div>
      </header>

      <nav className="nav" aria-label={t("home")}>
        <div className="nav__inner">
          <Link href="/issues">{t("issues")}</Link>
          <Link href="/online-first">{t("onlineFirst")}</Link>
          <Link href="/weekly">{t("weekly")}</Link>
          <Link href="/search">{t("search")}</Link>
          <Link href="/about">{t("about")}</Link>
          <Link href="/for-authors">{t("forAuthors")}</Link>
          <Link href="/submit">{t("submit")}</Link>
        </div>
      </nav>
    </>
  );
}

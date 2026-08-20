import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";
import { journal } from "@/config/journal";

/**
 * Server Component. The only interactive part is the language switcher, which
 * is a Client Component of its own — SPEC.md §11 keeps the boundary that tight
 * on purpose.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");

  return (
    <header className="site-header">
      <a className="skip-link" href="#content">
        {t("skipToContent")}
      </a>

      <div className="site-header__bar">
        <Link href="/" className="site-header__title">
          {journal.name}
        </Link>
        <LanguageSwitcher current={locale} label={t("languageSwitcher")} />
      </div>

      <nav aria-label={t("home")}>
        <ul className="site-nav">
          <li>
            <Link href="/issues">{t("issues")}</Link>
          </li>
          <li>
            <Link href="/online-first">{t("onlineFirst")}</Link>
          </li>
          <li>
            <Link href="/search">{t("search")}</Link>
          </li>
          <li>
            <Link href="/about">{t("about")}</Link>
          </li>
          <li>
            <Link href="/for-authors">{t("forAuthors")}</Link>
          </li>
          <li>
            <Link href="/submit">{t("submit")}</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

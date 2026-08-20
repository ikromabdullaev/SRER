import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { journal } from "@/config/journal";

/**
 * The footer states what the journal is bound by: licence, access terms, and
 * the machine endpoints that make the record harvestable. On a journal with
 * no publication history these commitments are much of the available evidence,
 * so they are stated rather than tucked away.
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");

  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__grid">
          <div>
            <h2>{tf("journal")}</h2>
            <ul>
              <li><Link href="/about">{t("about")}</Link></li>
              <li><Link href="/editorial-board">{tf("board")}</Link></li>
              <li><Link href="/for-authors">{t("forAuthors")}</Link></li>
              <li><Link href="/submit">{t("submit")}</Link></li>
            </ul>
          </div>

          <div>
            <h2>{tf("read")}</h2>
            <ul>
              <li><Link href="/issues">{t("issues")}</Link></li>
              <li><Link href="/online-first">{t("onlineFirst")}</Link></li>
              <li><Link href="/weekly">{t("weekly")}</Link></li>
              <li><Link href="/search">{t("search")}</Link></li>
            </ul>
          </div>

          <div>
            <h2>{tf("openAccess")}</h2>
            <ul>
              <li>
                <a href={journal.license.url} rel="license">
                  {journal.license.name}
                </a>
              </li>
              <li>{tf("noFees")}</li>
            </ul>
          </div>

          <div>
            <h2>{tf("machines")}</h2>
            <ul>
              {/* Stated plainly: a harvester's operator should not have to
                  guess the endpoint, and naming it signals the record is
                  meant to be taken. */}
              {/* Plain anchors on purpose: these are XML endpoints, not
                  pages. A client-side Link would try to soft-navigate to a
                  document the router cannot render. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <li><a href="/api/oai?verb=Identify">OAI-PMH</a></li>
              <li><a href="/sitemap.xml">Sitemap</a></li>
            </ul>
          </div>
        </div>

        <p className="footer__legal" lang={locale}>
          {tf("legal", { publisher: journal.publisher })}
        </p>
      </div>
    </footer>
  );
}

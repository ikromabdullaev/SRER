import type { MetadataRoute } from "next";
import { absoluteUrl, isProvisionalOrigin } from "@/config/journal";

/**
 * robots.txt (SPEC.md §5.6).
 *
 * On the journal's own domain this allows everything except the admin
 * surfaces. Note what is NOT disallowed there:
 *
 *  - `/api/oai` — harvesters must reach it; that is the entire point.
 *  - PDFs in storage — a gated PDF is an unindexed article, and
 *    `citation_pdf_url` has to be fetchable by Google Scholar.
 *
 * SPEC.md is explicit that no article is ever `noindex` and no PDF is ever
 * gated, and that stays true wherever this journal actually lives.
 *
 * On a provisional origin it is the opposite: refuse everything. Until D2 is
 * resolved the site is running somewhere it will not stay, and every URL a
 * crawler took from here would enter the scholarly record pointing at a host
 * that is going to disappear. That is far worse than not being indexed for a
 * few weeks. See `isProvisionalOrigin`.
 */
export default function robots(): MetadataRoute.Robots {
  if (isProvisionalOrigin()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      // No sitemap: advertising one is an invitation, and this origin is not
      // inviting anybody.
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/admin"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // No `host`: it is a non-standard Yandex directive, deprecated since 2018,
    // and it expects a bare hostname rather than the URL Next emits.
  };
}

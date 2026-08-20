import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/journal";

/**
 * robots.txt (SPEC.md §5.6).
 *
 * Allows everything except the admin surfaces. Note what is NOT disallowed:
 *
 *  - `/api/oai` — harvesters must reach it; that is the entire point.
 *  - PDFs in storage — a gated PDF is an unindexed article, and
 *    `citation_pdf_url` has to be fetchable by Google Scholar.
 *
 * SPEC.md is explicit that no article is ever `noindex` and no PDF is ever
 * gated, so this file stays this short on purpose.
 */
export default function robots(): MetadataRoute.Robots {
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

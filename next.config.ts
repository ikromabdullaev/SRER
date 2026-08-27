import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./src/i18n/routing";
import { isProvisionalOrigin } from "./src/config/journal";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,

  /**
   * `robots.txt` asks a crawler not to fetch; `X-Robots-Tag` tells it not to
   * index. They are different instructions, and only the second survives a
   * page being linked from somewhere else — a disallowed URL can still appear
   * in results on the strength of inbound links alone.
   *
   * On a provisional origin both are sent, and this one also covers what
   * robots.txt cannot mark: `sitemap.xml` and the OAI-PMH endpoint, which are
   * not HTML and carry no meta tag. On the journal's real domain no header is
   * emitted at all.
   */
  async headers() {
    if (!isProvisionalOrigin()) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },

  async redirects() {
    return [
      {
        /**
         * SPEC.md §4.4 wants a plain 308 from `/` to `/en/` — permanent and
         * predictable, not content negotiation. next-intl's proxy would answer
         * this with a 307 (temporary), which tells a crawler the location may
         * change. Config redirects are evaluated before the proxy, so this wins.
         */
        source: "/",
        destination: `/${routing.defaultLocale}`,
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

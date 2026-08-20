import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./src/i18n/routing";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,

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

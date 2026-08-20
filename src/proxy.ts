import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Named `proxy.ts`: Next 16 deprecated the `middleware` file convention.
export default createMiddleware(routing);

export const config = {
  /**
   * Localised routes only.
   *
   * `/admin` is deliberately excluded: SPEC.md §7 makes it English-only and not
   * locale-prefixed. `/api` is excluded so OAI-PMH and the sitemap are not
   * redirected — a harvester following a 308 to a locale prefix is a harvester
   * that gives up.
   */
  // `/` is not here: it is a permanent 308 in next.config.ts, because
  // this proxy would answer it with a temporary 307.
  matcher: ["/(en|uz|ru)/:path*"],
};

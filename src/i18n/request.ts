import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * UI chrome messages.
 *
 * SPEC.md §4.1 draws a hard line between these and article metadata: these
 * catalogues are complete for every locale at all times, while article
 * translations are frequently missing and fall back at the database level. Do
 * not conflate the two — a missing UI string is a bug, a missing abstract is
 * an expected state with a designed presentation.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

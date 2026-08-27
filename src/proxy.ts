import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { routing } from "./i18n/routing";

const intlProxy = createMiddleware(routing);

/**
 * Two different jobs, split by path.
 *
 * `/admin` is English-only and not locale-prefixed (SPEC.md §7), so next-intl
 * must not touch it. It needs the opposite thing: a refreshed Supabase session
 * cookie, and a bounce to the login page when there is no session.
 */
async function withSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // getUser() below may rotate the refresh token, and Supabase invalidates the
  // old one the moment it does. Whatever response we finally return has to
  // carry the new cookies -- including a redirect, which is built fresh and
  // starts with none. Dropping them hands the browser a token that has already
  // been spent: the next request fails auth, bounces back here, and the
  // browser gives up with ERR_TOO_MANY_REDIRECTS.
  const rotated: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          for (const { name, value } of items) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of items) {
            response.cookies.set(name, value, options);
            rotated.push({ name, value, options });
          }
        },
      },
    },
  );

  // Refreshes an expiring token and rewrites the cookie. Verified against the
  // auth server rather than read from the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** A redirect that keeps whatever the session refresh just issued. */
  function redirect(url: URL) {
    const result = NextResponse.redirect(url);
    for (const { name, value, options } of rotated) {
      result.cookies.set(name, value, options);
    }
    return result;
  }

  const { pathname } = request.nextUrl;

  /**
   * The admin pages a person must reach *without* a session.
   *
   * `/admin/reset-password` is the load-bearing one. Supabase puts the
   * recovery token in the URL fragment, which browsers never send to a
   * server — so the proxy cannot see it, would treat the request as
   * anonymous, and would redirect. The redirect drops the fragment, and with
   * it the only copy of the token. The link would fail every time, for a
   * reason invisible from the server logs.
   */
  const PUBLIC_ADMIN_PATHS = [
    "/admin/login",
    "/admin/forgot-password",
    "/admin/reset-password",
  ];
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.includes(pathname);
  const isLogin = pathname === "/admin/login";

  if (!user && !isPublicAdminPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    // Come back to where they were headed once signed in.
    url.searchParams.set("next", pathname);
    return redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return redirect(url);
  }

  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return withSession(request);
  }

  /**
   * An address whose first segment is not a locale — `/about`, or a citation
   * that lost its `/en` in a PDF line break — is answered by the default
   * locale rather than thrown away.
   *
   * It also fixes the 404 itself. `localePrefix: "always"` means next-intl
   * does not redirect these, so `/nonsense` matched the `[locale]` segment
   * with locale="nonsense", and the layout's own `notFound()` fired *while
   * rendering* — after the response had begun streaming, which makes Next
   * swap in its bare `__next_error__` shell instead of the 404 page. Sending
   * it to `/en/nonsense` lets the miss resolve above the segment, where the
   * real not-found page answers it.
   */
  const first = pathname.split("/")[1];

  // A dot means a file, and every one of them is a real route: sitemap.xml
  // and robots.txt are the two URLs a crawler fetches before anything else.
  // This has to return, not fall through -- next-intl would redirect them into
  // a locale, and /en/sitemap.xml does not exist.
  if (first.includes(".")) {
    return NextResponse.next();
  }

  if (first && !hasLocale(routing.locales, first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  return intlProxy(request);
}

export const config = {
  /**
   * `/` is not here: it is a permanent 308 in next.config.ts, because
   * next-intl's proxy would answer it with a temporary 307, and config
   * redirects run ahead of the proxy.
   *
   * The bare single segment is here so that `/about` reaches the default
   * locale instead of dying, and so that `/nonsense` -- which matches the
   * [locale] segment with locale="nonsense" -- is redirected before the
   * layout can call notFound() mid-render and lose the 404 page to Next's
   * bare error shell. Exclusions live in the function body rather than in a
   * lookahead, because an escaping mistake in a matcher regex fails silently
   * and takes the admin session guard down with it.
   */
  matcher: ["/(en|uz|ru)/:path*", "/admin/:path*", "/:path"],
};

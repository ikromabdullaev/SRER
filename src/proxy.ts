import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
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
  const isLogin = pathname === "/admin/login";

  if (!user && !isLogin) {
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
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return withSession(request);
  }
  return intlProxy(request);
}

export const config = {
  // `/` is not here: it is a permanent 308 in next.config.ts, because
  // next-intl's proxy would answer it with a temporary 307.
  matcher: ["/(en|uz|ru)/:path*", "/admin/:path*"],
};

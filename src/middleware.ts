import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieItem = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = ["/", "/login", "/signup", "/join", "/terms", "/privacy", "/auth", "/api/keepalive", "/api/cron", "/manifest.webmanifest", "/sw.js", "/icon.svg", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // Decide redirects from cookie presence only — NO network call here. A slow or
  // unreachable Supabase must never hang the edge middleware (which 504s the whole
  // site). The real, secure auth check runs in requireMe() on every protected page.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value.length > 0);

  if (!hasAuthCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // NOTE: we deliberately do NOT redirect /login -> /home on cookie presence.
  // `hasAuthCookie` is unvalidated, so an expired-but-present cookie would send
  // the user to /home, where requireMe() does a real check, fails, and sends
  // them back to /login — an infinite loop that renders as a blank screen in an
  // installed PWA. The "already signed in" bounce lives in the /login and
  // /signup pages instead, where the session is actually verified.

  // Best-effort token refresh. Capped with a short race so it can never block the
  // response even if Supabase is unreachable.
  const response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(items: CookieItem[]) {
            for (const { name, value, options } of items) {
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch {
    // Refresh is best-effort; never fatal.
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|webmanifest|js)$).*)"],
};

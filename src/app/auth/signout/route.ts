import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

// Sign-out is also the recovery path for a dead session. Server Components
// cannot write cookies, so when a refresh token expires, requireMe() can detect
// it but cannot clear it — this Route Handler can. GET is supported on purpose
// so a stuck user can escape by typing the URL, with no working UI to click.
async function signOutAndRedirect(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } catch {
    // An already-invalid session can throw here; clearing the cookies below is
    // what actually matters.
  }

  // 303 so a POST from the sign-out form becomes a GET on /login. (307, the
  // NextResponse.redirect default, would re-issue the POST against the page.)
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  // Belt-and-braces: supabase-ssr may skip cookie removal when the token is
  // already dead, which is exactly the case that stranded the user.
  const store = await cookies();
  for (const c of store.getAll()) {
    // expires-in-the-past AND Max-Age=0: a bare `maxAge: 0` is dropped by the
    // serializer, which leaves an empty-valued cookie still sitting there.
    if (c.name.startsWith("sb-")) {
      response.cookies.set({ name: c.name, value: "", path: "/", expires: new Date(0), maxAge: 0 });
    }
  }

  return response;
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

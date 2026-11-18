import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// Lands here from an emailed link (password recovery). Turns the one-time code
// in the URL into a session cookie, then sends the user on to `next`.
//
// Two link shapes are supported, because which one Supabase sends depends on
// the email template: `?code=` (PKCE, the default) and `?token_hash=&type=`.

// Only same-origin paths, so a crafted ?next= can't bounce off-site.
function safePath(p: string | null, fallback: string) {
  return p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : fallback;
}

const OTP_TYPES: EmailOtpType[] = ["recovery", "signup", "invite", "magiclink", "email", "email_change"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safePath(params.get("next"), "/home");
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  // Relative to the URL the request actually arrived on, so this never leaves
  // the site it was served from.
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), { status: 303 });
  const failed = () => to(`/forgot?error=${encodeURIComponent("That link has expired or was already used. Request a new one.")}`);

  try {
    const supabase = await supabaseServer();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return error ? failed() : to(next);
    }
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      return error ? failed() : to(next);
    }
  } catch {
    return failed();
  }
  return failed();
}

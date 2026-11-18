import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import SubmitButton from "@/components/SubmitButton";

export const metadata = { title: "Reset your password" };

// Where the emailed link should come back to. A configured site URL wins;
// otherwise use the host this request arrived on (Vercel sets x-forwarded-*).
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    if (email) {
      try {
        const supabase = await supabaseServer();
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${await siteOrigin()}/auth/callback?next=/reset`,
        });
      } catch {
        // Deliberately swallowed: see below.
      }
    }
    // The same answer whether or not the address has an account, and whether or
    // not sending worked, so this page can't be used to find out who is registered.
    redirect("/forgot?sent=1");
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={<Link className="text-accentInk font-semibold underline underline-offset-2 inline-flex items-center min-h-[44px]" href="/login">Back to sign in</Link>}
    >
      {sp.sent ? (
        <div className="space-y-2" role="status">
          <p className="font-semibold">Check your inbox.</p>
          <p className="text-muted text-[15px] leading-snug">If that address has an account, a reset link is on its way. It can take a minute, and may land in spam.</p>
        </div>
      ) : (
        <form action={sendLink} className="space-y-3">
          <div>
            <label className="label" htmlFor="forgot-email">Email</label>
            <input id="forgot-email" className="input" name="email" type="email" autoComplete="email" required />
          </div>
          {sp.error && <p className="text-accentInk text-sm font-semibold" role="alert">{sp.error}</p>}
          <SubmitButton className="btn btn-primary w-full" pendingLabel="Sending…">Email me a reset link</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}

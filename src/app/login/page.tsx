import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; error?: string }> }) {
  return <LoginInner searchParamsP={searchParams} />;
}

// Only same-origin paths, so a crafted ?redirect= can't bounce off-site.
function safePath(p: string | undefined, fallback: string) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : fallback;
}

async function LoginInner({ searchParamsP }: { searchParamsP: Promise<{ redirect?: string; error?: string }> }) {
  const sp = await searchParamsP;

  // The real "already signed in?" check. This used to live in the middleware,
  // which only saw that a cookie existed — an expired one sent the user to
  // /home, which bounced them back here, forever. Verify before redirecting,
  // and never let a slow Supabase block the form from rendering.
  let signedIn = false;
  try {
    const supabase = await supabaseServer();
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) => setTimeout(() => resolve({ data: { user: null } }), 1500)),
    ]);
    signedIn = Boolean(result.data.user);
  } catch {
    signedIn = false;
  }
  // Outside the try: redirect() signals via a thrown error the catch would eat.
  if (signedIn) redirect(safePath(sp.redirect, "/home"));

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const redirectTo = safePath(String(formData.get("redirect") || ""), "/home");
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const params = new URLSearchParams();
      params.set("error", error.message);
      if (redirectTo) params.set("redirect", redirectTo);
      redirect(`/login?${params.toString()}`);
    }
    redirect(redirectTo);
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your space."
      footer={<>New here? <Link className="text-ink underline" href="/signup">Create an account</Link></>}
    >
      <form action={signIn} className="space-y-3">
        <input type="hidden" name="redirect" value={sp.redirect ?? "/"} />
        <div>
          <label className="label">Email</label>
          <input className="input" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </div>
        {sp.error && <p className="text-accent text-sm">{sp.error}</p>}
        <button className="btn btn-primary w-full cta-glow" type="submit">Sign in</button>
      </form>
    </AuthShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; error?: string }> }) {
  return <LoginInner searchParamsP={searchParams} />;
}

async function LoginInner({ searchParamsP }: { searchParamsP: Promise<{ redirect?: string; error?: string }> }) {
  const sp = await searchParamsP;

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const redirectTo = String(formData.get("redirect") || "/");
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const params = new URLSearchParams();
      params.set("error", error.message);
      if (redirectTo) params.set("redirect", redirectTo);
      redirect(`/login?${params.toString()}`);
    }
    redirect(redirectTo || "/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-6 w-full max-w-sm">
        <h1 className="h1 mb-1">Tether</h1>
        <p className="muted mb-6">Sign in to your space.</p>
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
          <button className="btn btn-primary w-full" type="submit">Sign in</button>
        </form>
        <p className="muted text-center mt-6">
          New here? <Link className="text-ink underline" href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}

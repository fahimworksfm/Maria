import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <SignupInner searchParamsP={searchParams} />;
}

async function SignupInner({ searchParamsP }: { searchParamsP: Promise<{ error?: string }> }) {
  const sp = await searchParamsP;

  async function signUp(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const display = String(formData.get("display_name") || "").trim();
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: display } },
    });
    if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    redirect("/pair");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-6 w-full max-w-sm">
        <h1 className="h1 mb-1">Tether</h1>
        <p className="muted mb-6">Create your account.</p>
        <form action={signUp} className="space-y-3">
          <div>
            <label className="label">Your name</label>
            <input className="input" name="display_name" type="text" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {sp.error && <p className="text-accent text-sm">{sp.error}</p>}
          <button className="btn btn-primary w-full" type="submit">Create account</button>
        </form>
        <p className="muted text-center mt-6">
          Already paired? <Link className="text-ink underline" href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

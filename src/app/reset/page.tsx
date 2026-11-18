import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import SubmitButton from "@/components/SubmitButton";

export const metadata = { title: "Choose a new password" };

// Reached from the emailed link, after /auth/callback has signed the user in.
// Without that session there is nobody to set a password for.
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot");

  async function setPassword(formData: FormData) {
    "use server";
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    const fail = (msg: string) => redirect(`/reset?error=${encodeURIComponent(msg)}`);
    if (password.length < 8) fail("Use at least 8 characters.");
    if (password !== confirm) fail("The two passwords don't match.");
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/forgot");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) fail(error.message);
    redirect("/home");
  }

  return (
    <AuthShell title="Choose a new password" subtitle={data.user.email ? `For ${data.user.email}` : undefined}>
      <form action={setPassword} className="space-y-3">
        <div>
          <label className="label" htmlFor="reset-new">New password</label>
          <input id="reset-new" className="input" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <div>
          <label className="label" htmlFor="reset-confirm">Type it again</label>
          <input id="reset-confirm" className="input" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        {sp.error && <p className="text-accentInk text-sm font-semibold" role="alert">{sp.error}</p>}
        <SubmitButton className="btn btn-primary w-full" pendingLabel="Saving…">Save and sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}

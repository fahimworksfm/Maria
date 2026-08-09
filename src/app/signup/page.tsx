import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomInviteCode } from "@/lib/crypto";
import AuthShell from "@/components/AuthShell";

export default function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; code?: string }> }) {
  return <SignupInner searchParamsP={searchParams} />;
}

async function SignupInner({ searchParamsP }: { searchParamsP: Promise<{ error?: string; code?: string }> }) {
  const sp = await searchParamsP;
  const code = sp.code?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || null;

  // Verified "already signed in" bounce — see the note in /login. The
  // middleware can't do this safely because it never validates the cookie.
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
  // Outside the try: redirect() throws to signal, and the catch would eat it.
  if (signedIn) redirect("/home");

  // If a code is present, look up the inviter for a friendly header.
  let inviter: { name: string | null } | null = null;
  if (code) {
    const admin = supabaseAdmin();
    const { data: couple } = await admin
      .from("couples")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (couple) {
      const { data: members } = await admin
        .from("profiles")
        .select("display_name")
        .eq("couple_id", couple.id)
        .limit(1);
      inviter = { name: members?.[0]?.display_name ?? null };
    }
  }

  async function signUp(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const display = String(formData.get("display_name") || "").trim();
    const codeIn = String(formData.get("code") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || null;

    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: display } },
    });
    if (error) {
      const params = new URLSearchParams({ error: error.message });
      if (codeIn) params.set("code", codeIn);
      redirect(`/signup?${params.toString()}`);
    }
    const user = data.user;
    if (!user) {
      // Email confirmation must be off in Supabase. If it isn't, the user
      // won't have a session yet — direct them to sign in after confirming.
      redirect("/login?error=Check+your+email+to+confirm,+then+sign+in.");
    }

    const admin = supabaseAdmin();
    // The auth trigger creates the profile row; this upsert ensures the
    // display_name is present and survives any trigger timing.
    await admin
      .from("profiles")
      .upsert({ user_id: user.id, display_name: display || null }, { onConflict: "user_id" });

    if (codeIn) {
      // Auto-join the existing couple via invite code.
      const { data: couple } = await admin
        .from("couples")
        .select("id")
        .eq("invite_code", codeIn)
        .maybeSingle();
      if (!couple) redirect("/pair?error=Invite+code+not+found");
      const { count } = await admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("couple_id", couple.id);
      if ((count ?? 0) >= 2) redirect("/pair?error=That+couple+is+full");
      await admin.from("profiles").update({ couple_id: couple.id }).eq("user_id", user.id);
      redirect("/welcome");
    }

    // Otherwise: auto-create a couple for this user.
    const newCode = randomInviteCode();
    const { data: newCouple, error: cErr } = await admin
      .from("couples")
      .insert({ invite_code: newCode })
      .select("id")
      .single();
    if (cErr || !newCouple) redirect(`/pair?error=${encodeURIComponent(cErr?.message ?? "Failed to create space")}`);
    await admin.from("profiles").update({ couple_id: newCouple.id }).eq("user_id", user.id);
    redirect("/pair/invite");
  }

  const title = inviter ? "You're invited" : "Create your space";
  const subtitle = inviter
    ? `${inviter.name ? `${inviter.name} wants` : "Someone wants"} to share a Tether with you.`
    : "Two minutes, and it's yours.";

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      footer={<>Already have an account? <Link className="text-ink underline" href="/login">Sign in</Link></>}
    >
      <form action={signUp} className="space-y-3">
          {code && <input type="hidden" name="code" value={code} />}
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
          <label className="flex items-start gap-2 text-xs muted">
            <input type="checkbox" name="agree" required className="mt-0.5" />
            <span>
              I&apos;m 18 or older and I agree to the{" "}
              <Link href="/terms" className="underline text-ink">Terms</Link> and{" "}
              <Link href="/privacy" className="underline text-ink">Privacy Policy</Link>.
            </span>
          </label>
          <button className="btn btn-primary w-full cta-glow" type="submit">
            {code ? "Create account & join" : "Create my space"}
          </button>
        </form>
    </AuthShell>
  );
}

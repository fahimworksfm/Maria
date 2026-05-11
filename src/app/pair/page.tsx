import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireMe } from "@/lib/couple";
import { randomInviteCode } from "@/lib/crypto";

export default async function PairPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireMe();
  if (me.coupleId) redirect("/home");
  const sp = await searchParams;

  async function createCouple(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim() || null;
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    // Use admin client to bootstrap: at this moment the user is authenticated
    // but not yet a couple member, so RLS would block them from creating
    // and reading back the row they need to own. Service-role bypasses RLS;
    // we still gate on auth.getUser() above.
    const admin = supabaseAdmin();
    const code = randomInviteCode();
    const { data: couple, error: cErr } = await admin
      .from("couples")
      .insert({ name, invite_code: code })
      .select("id")
      .single();
    if (cErr || !couple) redirect(`/pair?error=${encodeURIComponent(cErr?.message ?? "Could not create couple")}`);
    const { error: pErr } = await admin
      .from("profiles")
      .update({ couple_id: couple.id })
      .eq("user_id", user.id);
    if (pErr) redirect(`/pair?error=${encodeURIComponent(pErr.message)}`);
    redirect("/pair/invite");
  }

  async function joinCouple(formData: FormData) {
    "use server";
    const code = String(formData.get("code") || "").trim().toUpperCase();
    if (!code) redirect("/pair?error=Enter+an+invite+code");
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const admin = supabaseAdmin();
    const { data: couple, error } = await admin
      .from("couples")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (error || !couple) redirect(`/pair?error=${encodeURIComponent("No couple with that code")}`);

    const { count } = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("couple_id", couple.id);
    if ((count ?? 0) >= 2) redirect("/pair?error=That+couple+is+full");

    const { error: uErr } = await admin
      .from("profiles")
      .update({ couple_id: couple.id })
      .eq("user_id", user.id);
    if (uErr) redirect(`/pair?error=${encodeURIComponent(uErr.message)}`);
    redirect("/home");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="card p-6">
          <h2 className="h2 mb-2">Start a new Tether</h2>
          <p className="muted mb-4">Create your shared space. You&apos;ll get an invite code to send to your partner.</p>
          <form action={createCouple} className="space-y-3">
            <input className="input" name="name" placeholder="A name for your space (optional)" />
            <button className="btn btn-primary w-full" type="submit">Create</button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="h2 mb-2">Join an existing Tether</h2>
          <p className="muted mb-4">If your partner already created one, paste their code.</p>
          <form action={joinCouple} className="space-y-3">
            <input className="input uppercase tracking-widest text-center" name="code" placeholder="ABC123" maxLength={6} required />
            <button className="btn w-full" type="submit">Join</button>
          </form>
        </div>

        {sp.error && <p className="text-accent text-sm text-center">{sp.error}</p>}
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashPin, verifyPin } from "@/lib/crypto";
import { aiEnabled, chatJson } from "@/lib/groq";
import { isVaultUnlocked, lockVault, unlockVault } from "@/lib/vault";

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("vault_pin_hash, vault_pin_salt")
    .eq("user_id", me.userId)
    .single();

  const hasPin = Boolean(profile?.vault_pin_hash && profile?.vault_pin_salt);

  if (!hasPin) {
    return <SetupPinView error={sp.error} />;
  }

  const unlocked = await isVaultUnlocked(me.userId);
  if (!unlocked) {
    return <UnlockView error={sp.error} />;
  }

  return <VaultInner />;
}

// ----------------------------------------------------------------------------
// PIN setup
// ----------------------------------------------------------------------------

function SetupPinView({ error }: { error?: string }) {
  async function setupPin(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const pin = String(formData.get("pin") || "");
    const confirm = String(formData.get("confirm") || "");
    if (pin.length < 4 || pin.length > 12) redirect("/vault?error=PIN+must+be+4-12+characters");
    if (pin !== confirm) redirect("/vault?error=PINs+do+not+match");
    const { hash, salt } = hashPin(pin);
    // Use service role to write the hash (RLS-safe: still scoped to this user).
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("profiles")
      .update({ vault_pin_hash: hash, vault_pin_salt: salt })
      .eq("user_id", me.userId);
    if (error) redirect(`/vault?error=${encodeURIComponent(error.message)}`);
    await unlockVault(me.userId);
    redirect("/vault");
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="h1">Gift Vault</h1>
        <p className="muted">Set a PIN. Only you ever see what&apos;s inside.</p>
      </header>
      <form action={setupPin} className="card p-5 space-y-3">
        <div>
          <label className="label">Choose a PIN (4–12 chars)</label>
          <input className="input" type="password" inputMode="numeric" name="pin" autoComplete="new-password" required minLength={4} maxLength={12} />
        </div>
        <div>
          <label className="label">Confirm PIN</label>
          <input className="input" type="password" inputMode="numeric" name="confirm" autoComplete="new-password" required minLength={4} maxLength={12} />
        </div>
        {error && <p className="text-accent text-sm">{error}</p>}
        <button className="btn btn-primary w-full" type="submit">Create vault</button>
      </form>
      <p className="muted text-xs">Tether scopes vault rows to your user ID at the database level — your partner cannot read them even with the app open on their phone.</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Unlock
// ----------------------------------------------------------------------------

function UnlockView({ error }: { error?: string }) {
  async function unlock(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const pin = String(formData.get("pin") || "");
    const supabase = await supabaseServer();
    const { data: prof } = await supabase
      .from("profiles")
      .select("vault_pin_hash, vault_pin_salt")
      .eq("user_id", me.userId)
      .single();
    if (!prof?.vault_pin_hash || !prof.vault_pin_salt) redirect("/vault?error=No+PIN+set");
    const ok = verifyPin(pin, prof.vault_pin_hash, prof.vault_pin_salt);
    if (!ok) redirect("/vault?error=Wrong+PIN");
    await unlockVault(me.userId);
    redirect("/vault");
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="h1">Gift Vault</h1>
        <p className="muted">Enter your PIN to unlock.</p>
      </header>
      <form action={unlock} className="card p-5 space-y-3">
        <input className="input" type="password" inputMode="numeric" name="pin" autoComplete="current-password" required autoFocus />
        {error && <p className="text-accent text-sm">{error}</p>}
        <button className="btn btn-primary w-full" type="submit">Unlock</button>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Inner vault
// ----------------------------------------------------------------------------

async function VaultInner() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: gifts } = await supabase
    .from("vault_gifts")
    .select("id, title, description, occasion, budget_cents, due_on, status, created_at")
    .eq("owner_id", me.userId)
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Partner profile preferences are readable.
  const { data: partnerProfile } = await supabase
    .from("profiles")
    .select("display_name, prefs")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();

  async function lock() {
    "use server";
    await lockVault();
    redirect("/vault");
  }

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    if (!(await isVaultUnlocked(me.userId))) redirect("/vault");
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    const budgetStr = String(formData.get("budget") || "").trim();
    const cents = budgetStr ? Math.round(Number(budgetStr) * 100) : null;
    await supabase.from("vault_gifts").insert({
      owner_id: me.userId,
      title,
      description: String(formData.get("description") || "").trim() || null,
      occasion: String(formData.get("occasion") || "").trim() || null,
      budget_cents: Number.isFinite(cents) ? cents : null,
      due_on: String(formData.get("due_on") || "") || null,
      status: (formData.get("status") as string) || "idea",
    });
    revalidatePath("/vault");
  }

  async function setStatus(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    if (!(await isVaultUnlocked(me.userId))) redirect("/vault");
    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "idea");
    const supabase = await supabaseServer();
    await supabase.from("vault_gifts").update({ status }).eq("id", id).eq("owner_id", me.userId);
    revalidatePath("/vault");
  }

  async function remove(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    if (!(await isVaultUnlocked(me.userId))) redirect("/vault");
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("vault_gifts").delete().eq("id", id).eq("owner_id", me.userId);
    revalidatePath("/vault");
  }

  async function suggestGifts(formData: FormData) {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    if (!(await isVaultUnlocked(me.userId))) redirect("/vault");
    const occasion = String(formData.get("occasion") || "").trim() || "any occasion";
    const budget = String(formData.get("budget") || "").trim() || "any budget";
    const supabase = await supabaseServer();
    const { data: partner } = await supabase
      .from("profiles")
      .select("display_name, prefs")
      .neq("user_id", me.userId)
      .limit(1)
      .maybeSingle();

    // Only partner *preferences* (not your existing vault rows) are sent.
    type Gen = { ideas: Array<{ title: string; description: string }> };
    const out = await chatJson<Gen>({
      system:
        "You suggest thoughtful, specific gifts for one person based on their stated preferences. Output strict JSON: {\"ideas\":[{\"title\":string,\"description\":string}]}. Five ideas. Titles under 8 words. Descriptions under 35 words. Specific products or concrete experiences, not categories.",
      user: `Recipient: ${partner?.display_name ?? "partner"}\nPreferences (JSON): ${JSON.stringify(partner?.prefs ?? {})}\nOccasion: ${occasion}\nBudget: ${budget}`,
      maxTokens: 700,
    });
    const rows = (out.ideas ?? []).slice(0, 5).map((i) => ({
      owner_id: me.userId,
      title: String(i.title).slice(0, 120),
      description: String(i.description).slice(0, 500),
      occasion: occasion === "any occasion" ? null : occasion,
      status: "idea" as const,
    }));
    if (rows.length) await supabase.from("vault_gifts").insert(rows);
    revalidatePath("/vault");
  }

  const fmtMoney = (c: number | null) => (c == null ? "" : `$${(c / 100).toFixed(2)}`);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="h1">Gift Vault</h1>
          <p className="muted">Private to you. Unlocks for 30 min.</p>
        </div>
        <form action={lock}><button className="btn btn-ghost text-xs" type="submit">Lock now</button></form>
      </header>

      <section className="card p-4 space-y-2">
        <h3 className="label">Partner&apos;s wishlist (read-only)</h3>
        <p className="text-sm whitespace-pre-wrap">
          {readWishlist(partnerProfile?.prefs) || <span className="muted">They haven&apos;t added one yet.</span>}
        </p>
        <p className="muted text-xs">Sizes & favourites: {readSizes(partnerProfile?.prefs) || "—"}</p>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="label">AI gift suggestions</h3>
        <form action={suggestGifts} className="grid grid-cols-2 gap-2">
          <input className="input" name="occasion" placeholder="Occasion (e.g. birthday)" />
          <input className="input" name="budget" placeholder="Budget (e.g. $80)" />
          <button className="btn btn-primary col-span-2" type="submit" disabled={!aiEnabled()}>
            {aiEnabled() ? "Suggest 5" : "Set GROQ_API_KEY to enable"}
          </button>
        </form>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="label">Add a gift idea</h3>
        <form action={add} className="space-y-2">
          <input className="input" name="title" placeholder="What is it?" required />
          <textarea className="input" name="description" placeholder="Notes" rows={2} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" name="occasion" placeholder="Occasion" />
            <input className="input" name="budget" type="number" step="0.01" placeholder="Budget $" />
            <input className="input" name="due_on" type="date" />
          </div>
          <select className="input" name="status" defaultValue="idea">
            <option value="idea">Idea</option>
            <option value="planned">Planned</option>
            <option value="bought">Bought</option>
            <option value="given">Given</option>
          </select>
          <button className="btn w-full" type="submit">Save</button>
        </form>
      </section>

      <section className="space-y-2">
        <h3 className="label">Your gifts</h3>
        {(gifts ?? []).map((g) => (
          <div key={g.id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{g.title}</div>
                {g.description && <p className="muted text-xs">{g.description}</p>}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {g.occasion && <span className="pill">{g.occasion}</span>}
                  {g.budget_cents != null && <span className="pill">{fmtMoney(g.budget_cents)}</span>}
                  {g.due_on && <span className="pill">by {g.due_on}</span>}
                  <span className="pill">{g.status}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <form action={setStatus} className="flex">
                  <input type="hidden" name="id" value={g.id} />
                  <select className="input text-xs py-1" name="status" defaultValue={g.status}>
                    <option value="idea">Idea</option>
                    <option value="planned">Planned</option>
                    <option value="bought">Bought</option>
                    <option value="given">Given</option>
                  </select>
                  <button className="btn btn-ghost text-xs" type="submit">Set</button>
                </form>
                <form action={remove}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="btn btn-ghost text-xs" type="submit">Delete</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {gifts && gifts.length === 0 && <p className="muted">No ideas yet.</p>}
      </section>

      <p className="muted text-xs">
        Tip: have your partner fill in their wishlist on{" "}
        <Link className="underline" href="/profile">My Preferences</Link>{" "}
        so you both get better suggestions.
      </p>
    </div>
  );
}

function readWishlist(prefs: unknown): string {
  if (prefs && typeof prefs === "object" && "wishlist" in prefs) {
    const w = (prefs as { wishlist?: unknown }).wishlist;
    if (typeof w === "string") return w;
  }
  return "";
}

function readSizes(prefs: unknown): string {
  if (prefs && typeof prefs === "object" && "sizes" in prefs) {
    const s = (prefs as { sizes?: unknown }).sizes;
    if (typeof s === "string") return s;
  }
  return "";
}

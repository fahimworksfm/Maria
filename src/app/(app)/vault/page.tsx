import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashPin, verifyPin } from "@/lib/crypto";
import { aiEnabled, chatJson } from "@/lib/groq";
import { isVaultUnlocked, lockVault, unlockVault } from "@/lib/vault";
import SubmitButton from "@/components/SubmitButton";
import { Lock } from "lucide-react";

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
    <div className="private-room space-y-4">
      <VaultHeader sub="A thread with only you in it" />
      <div className="thread">
        <p className="bubble bubble-them">This side of Tether goes dark on purpose. Your partner never sees anything in here.</p>
        <p className="bubble bubble-them">Choose a PIN to set it up. You&apos;ll need it each time you come back.</p>
      </div>
      <form action={setupPin} className="card p-3.5 space-y-3">
        <div>
          <label className="label" htmlFor="vault-pin">Choose a PIN (4–12 characters)</label>
          <input id="vault-pin" className="input tracking-[0.2em]" type="password" inputMode="numeric" name="pin" autoComplete="new-password" required minLength={4} maxLength={12} />
        </div>
        <div>
          <label className="label" htmlFor="vault-confirm">Confirm PIN</label>
          <input id="vault-confirm" className="input tracking-[0.2em]" type="password" inputMode="numeric" name="confirm" autoComplete="new-password" required minLength={4} maxLength={12} />
        </div>
        {error && <p className="text-accentInk text-sm font-semibold" role="alert">{error}</p>}
        <SubmitButton className="btn btn-primary w-full">Create vault</SubmitButton>
      </form>
      <p className="muted text-xs">Tether scopes vault rows to your user ID at the database level — your partner cannot read them even with the app open on their phone.</p>
    </div>
  );
}

function VaultHeader({ sub, children }: { sub: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full" style={{ background: "rgb(var(--c-prim-bg))", color: "rgb(var(--c-prim-fg))" }} aria-hidden>
          <Lock size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="font-bold leading-tight">Gift Vault</h1>
          <p className="text-muted text-[13px] leading-tight">{sub}</p>
        </div>
      </div>
      {children}
    </header>
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
    <div className="private-room space-y-4">
      <VaultHeader sub="A thread with only you in it" />
      <div className="thread">
        <p className="bubble bubble-them">This side of Tether goes dark on purpose. Your partner never sees anything in here.</p>
        <p className="bubble bubble-them">Enter your PIN to unlock your gift ideas and their wishlist.</p>
      </div>
      <form action={unlock} className="card p-3.5 space-y-2.5">
        <label className="label" htmlFor="vault-unlock">Your PIN</label>
        <div className="flex gap-2">
          <input id="vault-unlock" className="input tracking-[0.2em] min-w-0" type="password" inputMode="numeric" name="pin" autoComplete="current-password" required autoFocus />
          <button className="btn btn-primary shrink-0" type="submit">Unlock</button>
        </div>
        {error && <p className="text-accentInk text-sm font-semibold" role="alert">{error}</p>}
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
    <div className="private-room space-y-5">
      <VaultHeader sub="Private to you. Unlocks for 30 min.">
        <form action={lock}><button className="btn btn-ghost text-sm shrink-0" type="submit">Lock now</button></form>
      </VaultHeader>

      {/* Their side of this private thread: the wishlist they chose to share. */}
      <section className="thread">
        <p className="bubble bubble-them">
          {readWishlist(partnerProfile?.prefs) || "They haven't added a wishlist yet."}
        </p>
        <span className="stamp">Their wishlist · read-only · Sizes &amp; favourites: {readSizes(partnerProfile?.prefs) || "—"}</span>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="label">AI gift suggestions</h3>
        <form action={suggestGifts} className="grid grid-cols-2 gap-2">
          <input className="input" name="occasion" placeholder="Occasion (e.g. birthday)" />
          <input className="input" name="budget" placeholder="Budget (e.g. $80)" />
          <SubmitButton className="btn btn-primary col-span-2" disabled={!aiEnabled()} pendingLabel="Generating…">
            {aiEnabled() ? "Suggest 5" : "Set GROQ_API_KEY to enable"}
          </SubmitButton>
        </form>
      </section>

      <section>
        <h3 className="label">Your ideas</h3>
        {(gifts ?? []).map((g) => (
          <div key={g.id} className="row">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{g.title}</div>
                {g.description && <p className="muted">{g.description}</p>}
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
          <SubmitButton className="btn w-full">Save</SubmitButton>
        </form>
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

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { THEMES, DEFAULT_THEME } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";
import SoundToggle from "@/components/SoundToggle";
import SubmitButton from "@/components/SubmitButton";
import ModeToggle from "@/components/ModeToggle";
import PulseClient from "../pulse/PulseClient";
import { pushEnabled } from "@/lib/push";
import { isTempUnit, tempUnitFor } from "@/lib/weather";

type Prefs = {
  wishlist?: string;
  sizes?: string;
  favorites?: string;
  allergies?: string;
};

// Every write to prefs goes through here: read, merge, write. A plain helper,
// not a server action, so it can only be reached through the actions below.
// Callers pass the signed-in user's own id. Other features
// keep their own keys in the same JSON, and none of them may be wiped.
async function mergePrefs(userId: string, patch: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const supabase = await supabaseServer();
  const { data: prof } = await supabase.from("profiles").select("prefs").eq("user_id", userId).single();
  const current = prof?.prefs && typeof prof.prefs === "object" && !Array.isArray(prof.prefs) ? (prof.prefs as Record<string, unknown>) : {};
  await supabase
    .from("profiles")
    .update({ ...extra, prefs: { ...current, ...patch }, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ pw?: string; pwError?: string }> }) {
  const sp = await searchParams;
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: own } = await supabase
    .from("profiles")
    .select("display_name, birthday, prefs, timezone")
    .eq("user_id", me.userId)
    .single();
  const { data: couple } = await supabase
    .from("couples")
    .select("theme")
    .eq("id", me.coupleId)
    .single();
  const currentTheme = couple?.theme && THEMES[couple.theme] ? couple.theme : DEFAULT_THEME;

  async function setTheme(key: string) {
    "use server";
    const me = await requireCoupled();
    if (!THEMES[key]) return;
    const supabase = await supabaseServer();
    await supabase.from("couples").update({ theme: key }).eq("id", me.coupleId);
    revalidatePath("/", "layout");
  }
  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name, birthday, prefs")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();

  // Changes the signed-in user's own password. There is no email reset flow, so
  // this is the only self-serve way to set one.
  async function changePassword(formData: FormData) {
    "use server";
    await requireCoupled();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    const fail = (msg: string) => redirect(`/profile?pwError=${encodeURIComponent(msg)}#password`);
    if (password.length < 8) fail("Use at least 8 characters.");
    if (password !== confirm) fail("The two passwords don't match.");
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) fail(error.message);
    redirect("/profile?pw=changed#password");
  }

  async function setTempUnit(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const unit = formData.get("unit");
    if (!isTempUnit(unit)) return;
    await mergePrefs(me.userId, { tempUnit: unit });
    revalidatePath("/profile");
    revalidatePath("/together");
  }

  async function save(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    await mergePrefs(
      me.userId,
      {
        wishlist: String(formData.get("wishlist") || "").trim(),
        sizes: String(formData.get("sizes") || "").trim(),
        favorites: String(formData.get("favorites") || "").trim(),
        allergies: String(formData.get("allergies") || "").trim(),
      },
      {
        display_name: String(formData.get("display_name") || "").trim() || null,
        birthday: String(formData.get("birthday") || "") || null,
      }
    );
    revalidatePath("/profile");
  }

  const myPrefs = (own?.prefs ?? {}) as Prefs;
  const theirPrefs = (partner?.prefs ?? {}) as Prefs;
  const tempUnit = tempUnitFor(own?.prefs, own?.timezone);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">My Preferences</h1>
        <p className="muted">You edit your own. Your partner can read it (so they can shop). The gift Vault is separate and private.</p>
      </header>

      <section className="card p-4 space-y-3">
        <div>
          <h3 className="label">Your theme</h3>
          <p className="text-muted text-[13px]">Sets the colour of your bubbles and buttons for both of you.</p>
        </div>
        <ThemePicker current={currentTheme} action={setTheme} />
      </section>

      <section className="card px-4">
        <div className="row flex items-center justify-between gap-3 !py-3">
          <span className="text-[15px] font-semibold">Appearance</span>
          <ModeToggle />
        </div>
        <div className="row !py-3">
          <SoundToggle />
        </div>
        <form action={setTempUnit} className="row flex items-center justify-between gap-3 !py-3">
          <span className="text-[15px] font-semibold" id="temp-unit-label">Temperature</span>
          <span className="flex gap-1.5" role="group" aria-labelledby="temp-unit-label">
            {(["C", "F"] as const).map((u) => (
              <button
                key={u}
                type="submit"
                name="unit"
                value={u}
                aria-pressed={tempUnit === u}
                className={`btn min-w-[52px] ${tempUnit === u ? "btn-primary" : ""}`}
              >
                °{u}
              </button>
            ))}
          </span>
        </form>
      </section>

      <section id="notifications" className="space-y-2 scroll-mt-24">
        <div>
          <h3 className="label">Notifications</h3>
          <p className="text-muted text-[13px]">Lets a pulse or an answered prompt reach this device. Set it on each phone you use.</p>
        </div>
        <PulseClient publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} pushConfigured={pushEnabled()} />
      </section>

      <form action={save} className="card p-4 space-y-3">
        <div>
          <label className="label" htmlFor="pref-display_name">Display name</label>
          <input className="input" id="pref-display_name" name="display_name" defaultValue={own?.display_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="pref-birthday">Birthday</label>
          <input className="input" id="pref-birthday" name="birthday" type="date" defaultValue={own?.birthday ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="pref-wishlist">Wishlist (free-form)</label>
          <textarea className="input" id="pref-wishlist" name="wishlist" rows={4} defaultValue={myPrefs.wishlist ?? ""} placeholder="Books, things you'd love, experiences..." />
        </div>
        <div>
          <label className="label" htmlFor="pref-sizes">Sizes</label>
          <textarea className="input" id="pref-sizes" name="sizes" rows={2} defaultValue={myPrefs.sizes ?? ""} placeholder="Shirt M, shoe US 9, ring 6..." />
        </div>
        <div>
          <label className="label" htmlFor="pref-favorites">Favourites</label>
          <textarea className="input" id="pref-favorites" name="favorites" rows={2} defaultValue={myPrefs.favorites ?? ""} placeholder="Coffee order, snack, scent, colour..." />
        </div>
        <div>
          <label className="label" htmlFor="pref-allergies">Allergies / dislikes</label>
          <textarea className="input" id="pref-allergies" name="allergies" rows={2} defaultValue={myPrefs.allergies ?? ""} />
        </div>
        <SubmitButton className="btn btn-primary w-full">Save</SubmitButton>
      </form>

      <section className="thread">
        <h3 className="label">Partner&apos;s preferences (read-only)</h3>
        <Field title="Wishlist" value={theirPrefs.wishlist} />
        <Field title="Sizes" value={theirPrefs.sizes} />
        <Field title="Favourites" value={theirPrefs.favorites} />
        <Field title="Allergies / dislikes" value={theirPrefs.allergies} />
        {!partner && <p className="muted">Your partner hasn&apos;t signed up yet.</p>}
      </section>

      <form id="password" action={changePassword} className="card p-4 space-y-3 scroll-mt-24">
        <div>
          <h3 className="label">Change password</h3>
          <p className="muted">Sets a new password for your own account. You stay signed in on this device.</p>
        </div>
        <div>
          <label className="label" htmlFor="pw-new">New password</label>
          <input id="pw-new" className="input" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <div>
          <label className="label" htmlFor="pw-confirm">Type it again</label>
          <input id="pw-confirm" className="input" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        {sp.pwError && <p className="text-accentInk text-sm font-semibold" role="alert">{sp.pwError}</p>}
        {sp.pw === "changed" && <p className="text-sm font-semibold" role="status">Password changed.</p>}
        <SubmitButton className="btn w-full">Change password</SubmitButton>
      </form>

      <form action="/auth/signout" method="post" className="pt-2 text-center">
        <button className="btn btn-ghost text-muted" type="submit">Sign out</button>
      </form>
    </div>
  );
}

function Field({ title, value }: { title: string; value?: string }) {
  if (!value) return null;
  return (
    <>
      <p className="bubble bubble-them">{value}</p>
      <span className="stamp mb-1">{title}</span>
    </>
  );
}

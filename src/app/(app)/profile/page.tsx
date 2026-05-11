import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

type Prefs = {
  wishlist?: string;
  sizes?: string;
  favorites?: string;
  allergies?: string;
};

export default async function ProfilePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: own } = await supabase
    .from("profiles")
    .select("display_name, birthday, prefs")
    .eq("user_id", me.userId)
    .single();
  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name, birthday, prefs")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const prefs: Prefs = {
      wishlist: String(formData.get("wishlist") || "").trim(),
      sizes: String(formData.get("sizes") || "").trim(),
      favorites: String(formData.get("favorites") || "").trim(),
      allergies: String(formData.get("allergies") || "").trim(),
    };
    await supabase
      .from("profiles")
      .update({
        display_name: String(formData.get("display_name") || "").trim() || null,
        birthday: String(formData.get("birthday") || "") || null,
        prefs,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", me.userId);
    revalidatePath("/profile");
  }

  const myPrefs = (own?.prefs ?? {}) as Prefs;
  const theirPrefs = (partner?.prefs ?? {}) as Prefs;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">My Preferences</h1>
        <p className="muted">You edit your own. Your partner can read it (so they can shop). The gift Vault is separate and private.</p>
      </header>

      <form action={save} className="card p-4 space-y-3">
        <div>
          <label className="label">Display name</label>
          <input className="input" name="display_name" defaultValue={own?.display_name ?? ""} />
        </div>
        <div>
          <label className="label">Birthday</label>
          <input className="input" name="birthday" type="date" defaultValue={own?.birthday ?? ""} />
        </div>
        <div>
          <label className="label">Wishlist (free-form)</label>
          <textarea className="input" name="wishlist" rows={4} defaultValue={myPrefs.wishlist ?? ""} placeholder="Books, things you'd love, experiences..." />
        </div>
        <div>
          <label className="label">Sizes</label>
          <textarea className="input" name="sizes" rows={2} defaultValue={myPrefs.sizes ?? ""} placeholder="Shirt M, shoe US 9, ring 6..." />
        </div>
        <div>
          <label className="label">Favourites</label>
          <textarea className="input" name="favorites" rows={2} defaultValue={myPrefs.favorites ?? ""} placeholder="Coffee order, snack, scent, colour..." />
        </div>
        <div>
          <label className="label">Allergies / dislikes</label>
          <textarea className="input" name="allergies" rows={2} defaultValue={myPrefs.allergies ?? ""} />
        </div>
        <button className="btn btn-primary w-full" type="submit">Save</button>
      </form>

      <section className="card p-4 space-y-2">
        <h3 className="label">Partner&apos;s preferences (read-only)</h3>
        <Field title="Wishlist" value={theirPrefs.wishlist} />
        <Field title="Sizes" value={theirPrefs.sizes} />
        <Field title="Favourites" value={theirPrefs.favorites} />
        <Field title="Allergies / dislikes" value={theirPrefs.allergies} />
        {!partner && <p className="muted">Your partner hasn&apos;t signed up yet.</p>}
      </section>
    </div>
  );
}

function Field({ title, value }: { title: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="muted text-xs">{title}</div>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

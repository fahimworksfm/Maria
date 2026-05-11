import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { sendToUser, pushEnabled } from "@/lib/push";
import PulseClient from "./PulseClient";
import PulseButton from "./PulseButton";

export default async function PulsePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();

  const { data: partner } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();

  const { data: recent } = await supabase
    .from("nudges")
    .select("id, from_user, to_user, kind, message, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Mark incoming pulses as read.
  const unread = (recent ?? []).filter((n) => n.to_user === me.userId && !n.read_at);
  if (unread.length > 0) {
    await supabase
      .from("nudges")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((n) => n.id));
  }

  async function sendPulse(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const message = String(formData.get("message") || "").trim() || null;
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .neq("user_id", me.userId)
      .limit(1)
      .maybeSingle();
    if (!p?.user_id) return;
    await supabase.from("nudges").insert({
      couple_id: me.coupleId,
      from_user: me.userId,
      to_user: p.user_id,
      kind: "pulse",
      message,
    });
    if (pushEnabled()) {
      await sendToUser(p.user_id, {
        title: `${me.displayName ?? "Your partner"} sent a pulse`,
        body: message ?? "Thinking of you. 💗",
        url: "/pulse",
        vibrate: [180, 80, 180, 80, 180],
      });
    }
    revalidatePath("/pulse");
  }

  const partnerName = partner?.display_name ?? "your partner";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Pulse</h1>
        <p className="muted">A wordless &quot;thinking of you.&quot; Their phone buzzes.</p>
      </header>

      <PulseClient publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} pushConfigured={pushEnabled()} />

      <form action={sendPulse} className="card p-6 space-y-4 text-center">
        <p className="muted">Send a pulse to {partnerName}.</p>
        <PulseButton />
        <input
          className="input text-center"
          name="message"
          placeholder="Add a tiny message (optional)"
          maxLength={60}
        />
        <p className="muted text-xs">Tap the heart. Their phone will buzz.</p>
      </form>

      <section className="space-y-2">
        <h3 className="label">Recent</h3>
        {(recent ?? []).map((n) => (
          <div key={n.id} className="card p-3 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="text-sm">
                {n.from_user === me.userId ? "You sent a pulse" : `${partnerName} sent a pulse`}
                {n.from_user === me.userId && !n.read_at && <span className="pill ml-2">unread</span>}
              </div>
              {n.message && <p className="muted text-sm">{n.message}</p>}
            </div>
            <span className="muted text-xs">{new Date(n.created_at).toLocaleString()}</span>
          </div>
        ))}
        {(recent ?? []).length === 0 && <p className="muted">No pulses yet.</p>}
      </section>
    </div>
  );
}

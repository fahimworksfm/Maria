import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { sendToUser, pushEnabled } from "@/lib/push";
import PulseClient from "./PulseClient";
import PulseButton from "./PulseButton";
import LocalTime from "@/components/LocalTime";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { Heart } from "lucide-react";

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

  // Oldest first, so the newest message sits just above the composer.
  const thread = [...(recent ?? [])].slice(0, 30).reverse();
  const unreadIds = new Set(unread.map((n) => n.id));

  return (
    <div className="space-y-5">
      <RealtimeRefresh table="nudges" coupleId={me.coupleId} />
      <header>
        <h1 className="h1">Pulse</h1>
        <p className="muted">A wordless &quot;thinking of you.&quot; Their phone buzzes.</p>
      </header>

      <PulseClient publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} pushConfigured={pushEnabled()} />

      <section className="thread" aria-label="Recent pulses">
        {thread.map((n) => {
          const mine = n.from_user === me.userId;
          const isNew = unreadIds.has(n.id);
          return (
            <div key={n.id} className="contents">
              <div className={`bubble flex items-center gap-2 ${mine ? "bubble-me" : "bubble-them"} ${isNew ? "bubble-new" : ""}`}>
                <Heart size={15} fill="currentColor" className="shrink-0" aria-hidden />
                <span>{n.message ?? "Pulse"}</span>
              </div>
              <span className={`stamp ${mine ? "self-end" : ""}`}>
                <span className="sr-only">{mine ? "You, " : `${partnerName}, `}</span>
                <LocalTime iso={n.created_at} mode="relative" />
                {mine && (n.read_at ? " · seen" : " · not seen yet")}
                {isNew && " · new"}
              </span>
            </div>
          );
        })}
        {thread.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <span className="mark-box"><Heart size={20} aria-hidden /></span>
            <p className="font-bold pt-2">Send your first pulse.</p>
            <p className="muted">Tap the button below. Their phone will buzz.</p>
          </div>
        )}
      </section>

      {/* The composer: an optional few words, and the one big send. */}
      <form action={sendPulse} className="card p-3.5 space-y-2.5">
        <label htmlFor="pulse-message" className="sr-only">A few words (optional)</label>
        <input
          id="pulse-message"
          className="input !rounded-full"
          name="message"
          placeholder="Add a few words (optional)"
          maxLength={60}
        />
        <PulseButton />
        <p className="muted text-xs text-center">Goes to {partnerName}. Their phone will buzz.</p>
      </form>
    </div>
  );
}

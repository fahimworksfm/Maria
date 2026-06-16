import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import GratitudeBoard, { type Gratitude } from "./GratitudeBoard";

export default async function GratitudePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("gratitudes")
    .select("id, author_id, text, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();
  const partnerName = partner?.display_name ?? "partner";

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Gratitude Tree</h1><p className="muted">A leaf grows for each thanks.</p></header>
      <GratitudeBoard
        initial={(rows ?? []) as Gratitude[]}
        coupleId={me.coupleId}
        myUserId={me.userId}
        partnerName={partnerName}
      />
    </div>
  );
}

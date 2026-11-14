import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { partnerNameFor } from "@/lib/authorship";
import PlacesBoard, { type Place } from "./PlacesBoard";

export default async function PlacesPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("places")
    .select("*") // includes author_id once migration 0014 has run
    .eq("couple_id", me.coupleId)
    .order("visited", { ascending: true })
    .order("created_at", { ascending: false });

  const partnerName = await partnerNameFor(supabase, me.userId);

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Places</h1><p className="muted">Restaurants and spots — search to drop a pin.</p></header>
      <PlacesBoard initial={(rows ?? []) as Place[]} coupleId={me.coupleId} meId={me.userId} partnerName={partnerName} />
    </div>
  );
}

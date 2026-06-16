import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import PlacesBoard, { type Place } from "./PlacesBoard";

export default async function PlacesPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("places")
    .select("id, name, kind, notes, lat, lng, visited, rating, created_at")
    .eq("couple_id", me.coupleId)
    .order("visited", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Places</h1><p className="muted">Restaurants and spots — search to drop a pin.</p></header>
      <PlacesBoard initial={(rows ?? []) as Place[]} coupleId={me.coupleId} />
    </div>
  );
}

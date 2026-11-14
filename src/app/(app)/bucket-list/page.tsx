import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { partnerNameFor } from "@/lib/authorship";
import BucketListBoard, { type BucketItem } from "./BucketListBoard";

export default async function BucketListPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("bucket_items")
    .select("*") // includes author_id once migration 0014 has run
    .eq("couple_id", me.coupleId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  const partnerName = await partnerNameFor(supabase, me.userId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Bucket List</h1>
        <p className="muted">Dreams in progress.</p>
      </header>
      <BucketListBoard initial={(rows ?? []) as BucketItem[]} coupleId={me.coupleId} meId={me.userId} partnerName={partnerName} />
    </div>
  );
}

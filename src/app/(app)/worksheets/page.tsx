import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { WORKSHEETS } from "@/lib/worksheets";

export default async function WorksheetsIndex() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: responses } = await supabase
    .from("worksheet_responses")
    .select("worksheet_id, user_id, completed_at, answers")
    .in("worksheet_id", WORKSHEETS.map((w) => w.id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Worksheets</h1>
        <p className="muted">A few exercises you can do together. Take them with curiosity, not certainty.</p>
      </header>
      <div className="space-y-3">
        {WORKSHEETS.map((w) => {
          const mine = (responses ?? []).find((r) => r.worksheet_id === w.id && r.user_id === me.userId);
          const partner = (responses ?? []).find((r) => r.worksheet_id === w.id && r.user_id !== me.userId);
          const meStatus = mine?.completed_at ? "Done" : mine ? "In progress" : "Not started";
          const partnerStatus = partner?.completed_at ? "Done" : "Not done";
          return (
            <Link key={w.id} href={`/worksheets/${w.id}`} className="card card-hover p-4 block">
              <h3 className="font-medium">{w.title}</h3>
              <p className="muted text-sm mt-1">{w.intro.split(".")[0]}.</p>
              <div className="flex gap-2 mt-2">
                <span className="pill">You: {meStatus}</span>
                <span className="pill">Partner: {partnerStatus}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

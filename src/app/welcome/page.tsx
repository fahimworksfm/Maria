import "./welcome.css";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import Celebration from "./Celebration";

export const metadata = { title: "Tethered" };

export default async function WelcomePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("couple_id", me.coupleId);
  const names = (profiles ?? [])
    .map((p) => p.display_name)
    .filter((n): n is string => Boolean(n));

  return <Celebration names={names} />;
}

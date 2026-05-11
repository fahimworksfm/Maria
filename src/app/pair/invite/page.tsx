import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireCoupled } from "@/lib/couple";

export default async function InvitePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: couple } = await supabase
    .from("couples")
    .select("invite_code, name")
    .eq("id", me.coupleId)
    .single();

  if (!couple) redirect("/pair");

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-6 w-full max-w-sm text-center space-y-4">
        <h1 className="h1">Send this to your partner</h1>
        <p className="muted">They sign up at <span className="text-ink">/signup</span>, then enter this code on the pair screen.</p>
        <div className="text-4xl font-display tracking-widest bg-panel2 border border-line rounded-xl2 py-6">{couple.invite_code}</div>
        <p className="muted text-xs">Once they join, both of you can sign in and use Tether together.</p>
        <Link className="btn btn-primary w-full" href="/">Go to your space</Link>
      </div>
    </main>
  );
}

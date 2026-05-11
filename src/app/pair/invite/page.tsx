import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireCoupled } from "@/lib/couple";
import CopyButton from "./CopyButton";

export default async function InvitePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: couple } = await supabase
    .from("couples")
    .select("invite_code")
    .eq("id", me.coupleId)
    .single();

  if (!couple) redirect("/pair");

  // Check if partner has already joined
  const { count: memberCount } = await supabase
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("couple_id", me.coupleId);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${couple.invite_code}`;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-6 w-full max-w-md text-center space-y-4">
        <h1 className="h1">Send this to your partner</h1>
        <p className="muted">One link. They sign up and you&apos;re paired.</p>

        <div className="bg-panel2 border border-line rounded-xl2 p-4 break-all text-sm font-mono">
          {inviteUrl}
        </div>

        <CopyButton url={inviteUrl} name={me.displayName} />

        <details className="text-xs muted">
          <summary className="cursor-pointer">Or share the 6-character code instead</summary>
          <div className="text-3xl font-display tracking-widest mt-3 text-ink">{couple.invite_code}</div>
          <p className="mt-2">They can enter it manually on the join page.</p>
        </details>

        {(memberCount ?? 0) >= 2 ? (
          <Link className="btn btn-primary w-full" href="/home">Both joined — go to your space</Link>
        ) : (
          <Link className="btn w-full" href="/home">Go to your space</Link>
        )}
      </div>
    </main>
  );
}

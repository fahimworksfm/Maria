import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireCoupled } from "@/lib/couple";
import AuthShell from "@/components/AuthShell";
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
    <AuthShell title="Send this to your partner" subtitle="One link. They sign up and you're paired.">
      <div className="text-center space-y-4">
        {/* The link as the message you're about to send. */}
        <div className="thread">
          <div className="bubble bubble-me break-all text-left">{inviteUrl}</div>
          <span className="stamp self-end">Your invite link</span>
        </div>

        <CopyButton url={inviteUrl} name={me.displayName} />

        <details className="text-[13px] text-muted">
          <summary className="cursor-pointer inline-flex items-center min-h-[44px]">Or share the 6-character code instead</summary>
          <div className="text-3xl font-bold tracking-[0.3em] mt-2 text-ink">{couple.invite_code}</div>
          <p className="mt-2">They can enter it manually on the join page.</p>
        </details>

        {(memberCount ?? 0) >= 2 ? (
          <Link className="btn btn-primary w-full" href="/welcome">Both joined — see your moment</Link>
        ) : (
          <Link className="btn w-full" href="/home">Go to your space</Link>
        )}
      </div>
    </AuthShell>
  );
}

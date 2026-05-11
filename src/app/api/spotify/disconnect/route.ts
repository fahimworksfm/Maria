import { NextResponse } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const me = await requireCoupled();
  const admin = supabaseAdmin();
  await admin
    .from("couples")
    .update({
      spotify_refresh_token: null,
      spotify_playlist_id: null,
      spotify_connected_by: null,
      spotify_user_name: null,
      spotify_connected_at: null,
    })
    .eq("id", me.coupleId);
  return NextResponse.redirect(new URL("/songs", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Me = {
  userId: string;
  email: string | null;
  coupleId: string | null;
  displayName: string | null;
  hasVaultPin: boolean;
};

export async function getMe(): Promise<Me | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, couple_id, vault_pin_hash")
    .eq("user_id", user.id)
    .single();
  return {
    userId: user.id,
    email: user.email ?? null,
    coupleId: profile?.couple_id ?? null,
    displayName: profile?.display_name ?? null,
    hasVaultPin: Boolean(profile?.vault_pin_hash),
  };
}

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  // Route through /auth/signout rather than straight to /login. Getting here
  // with a stale auth cookie means the cookie must be cleared, and only a Route
  // Handler can do that — a Server Component's cookie writes are ignored. The
  // sign-out route lands on /login once the cookie is gone.
  if (!me) redirect("/auth/signout");
  return me;
}

export async function requireCoupled(): Promise<Me & { coupleId: string }> {
  const me = await requireMe();
  if (!me.coupleId) redirect("/pair");
  return { ...me, coupleId: me.coupleId };
}

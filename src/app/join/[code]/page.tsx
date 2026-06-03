import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function JoinByCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  // If the user is already signed in, route them based on whether they already have a couple.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = supabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("couple_id")
      .eq("user_id", user.id)
      .single();
    if (profile?.couple_id) {
      // Already in a couple — can't join another.
      redirect("/home");
    }
    const { data: couple } = await admin
      .from("couples")
      .select("id")
      .eq("invite_code", clean)
      .maybeSingle();
    if (!couple) redirect("/pair?error=Invite+code+not+found");
    const { count } = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("couple_id", couple.id);
    if ((count ?? 0) >= 2) redirect("/pair?error=That+couple+is+full");
    await admin.from("profiles").update({ couple_id: couple.id }).eq("user_id", user.id);
    redirect("/welcome");
  }

  // Not signed in: forward the code into the signup flow.
  redirect(`/signup?code=${clean}`);
}

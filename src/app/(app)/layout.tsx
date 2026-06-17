import Link from "next/link";
import { requireMe } from "@/lib/couple";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import PushRegistration from "@/components/PushRegistration";
import PartnerPresence from "@/components/PartnerPresence";
import OfflineStatus from "@/components/OfflineStatus";
import PageTransition from "@/components/PageTransition";
import { getTheme, themeVars } from "@/lib/themes";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (!me.coupleId) redirect("/pair");

  const supabase = await supabaseServer();
  const [{ data: partner }, { data: couple }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("couple_id", me.coupleId).neq("user_id", me.userId).limit(1).maybeSingle(),
    supabase.from("couples").select("theme").eq("id", me.coupleId).single(),
  ]);
  const partnerName = partner?.display_name ?? "Partner";
  const theme = getTheme(couple?.theme);

  return (
    <div id="app-shell" className="min-h-screen flex flex-col" style={themeVars(theme) as React.CSSProperties}>
      <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/home" className="font-display text-xl">Tether</Link>
            <PartnerPresence coupleId={me.coupleId} myUserId={me.userId} partnerName={partnerName} />
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link className="btn btn-ghost px-2" href="/profile">{me.displayName ?? "Me"}</Link>
            <form action="/auth/signout" method="post">
              <button className="btn btn-ghost px-2" type="submit">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-nav">
        <PageTransition>{children}</PageTransition>
      </main>
      <footer className="max-w-3xl w-full mx-auto px-4 pb-28 text-xs text-muted flex gap-3 justify-center">
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      </footer>
      <BottomNav />
      <PWAInstaller />
      <PushRegistration vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      <OfflineStatus />
    </div>
  );
}

function PWAInstaller() {
  // Register SW, actively check for updates on each load, and reload the page
  // when a new SW takes control (so users always see the latest UI).
  const script = `
    if ('serviceWorker' in navigator) {
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').then(function (reg) {
          try { reg.update(); } catch (e) {}
          reg.addEventListener('updatefound', function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', function () {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                // A new SW is installed and there's already a controller —
                // it'll take over via clients.claim() and trigger controllerchange.
              }
            });
          });
        }).catch(function () {});
      });
    }
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

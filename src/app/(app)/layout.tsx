import Link from "next/link";
import { requireMe } from "@/lib/couple";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (!me.coupleId) redirect("/pair");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-display text-xl">Tether</Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link className="btn btn-ghost px-2" href="/profile">{me.displayName ?? "Me"}</Link>
            <form action="/auth/signout" method="post">
              <button className="btn btn-ghost px-2" type="submit">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
      <PWAInstaller />
    </div>
  );
}

function BottomNav() {
  const items: Array<{ href: string; label: string }> = [
    { href: "/", label: "Home" },
    { href: "/memories", label: "Memories" },
    { href: "/journal", label: "Journal" },
    { href: "/date-roulette", label: "Dates" },
    { href: "/vault", label: "Vault" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg/90 backdrop-blur border-t border-line">
      <div className="max-w-3xl mx-auto px-2 py-2 grid grid-cols-5 text-center text-xs">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="py-2 rounded-md hover:bg-panel2">
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function PWAInstaller() {
  return (
    <script
      // Register service worker for PWA install + basic offline shell.
      dangerouslySetInnerHTML={{
        __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}`,
      }}
    />
  );
}

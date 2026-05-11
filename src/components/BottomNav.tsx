"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tap, HAPTIC } from "@/lib/haptic";

const ITEMS = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/journal", label: "Journal", icon: "📔" },
  { href: "/pulse", label: "Pulse", icon: "💗" },
  { href: "/vault", label: "Vault", icon: "🎁" },
  { href: "/profile", label: "Me", icon: "🪞" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur-lg border-t border-line z-30 safe-bottom">
      <div className="max-w-3xl mx-auto px-2 py-2 grid grid-cols-5">
        {ITEMS.map((it) => {
          const active = pathname === it.href || (it.href !== "/home" && pathname.startsWith(it.href + "/")) || pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              onPointerDown={() => tap(HAPTIC.tick)}
              prefetch={false}
              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-transform active:scale-90 ${active ? "nav-active" : "hover:bg-panel2"}`}
            >
              <span
                className="text-[26px] leading-none transition-transform"
                style={{ transform: active ? "scale(1.12)" : "scale(1)" }}
              >
                {it.icon}
              </span>
              <span className={`text-[11px] mt-0.5 ${active ? "text-ink font-medium" : "text-muted"}`}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

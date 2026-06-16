"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, NotebookPen, HeartPulse, History, User, type LucideIcon } from "lucide-react";
import { tap, HAPTIC } from "@/lib/haptic";

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/journal", label: "Journal", Icon: NotebookPen },
  { href: "/pulse", label: "Pulse", Icon: HeartPulse },
  { href: "/timeline", label: "Timeline", Icon: History },
  { href: "/profile", label: "Me", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg/85 backdrop-blur-xl border-t border-line/80 z-30 safe-bottom">
      <div className="max-w-3xl mx-auto px-2 py-2 grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              onPointerDown={() => tap(HAPTIC.tick)}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl transition-all active:scale-90 ${active ? "nav-active" : "hover:bg-panel2"}`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={`transition-all ${active ? "text-accent scale-110" : "text-muted"}`}
                aria-hidden
              />
              <span className={`text-[11px] ${active ? "text-ink font-medium" : "text-muted"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

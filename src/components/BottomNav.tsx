"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, NotebookPen, HeartPulse, Plane, User, type LucideIcon } from "lucide-react";
import { tap, HAPTIC } from "@/lib/haptic";

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home", label: "Thread", Icon: MessageCircle },
  { href: "/journal", label: "Journal", Icon: NotebookPen },
  { href: "/pulse", label: "Pulse", Icon: HeartPulse },
  { href: "/together", label: "Together", Icon: Plane },
  { href: "/profile", label: "Me", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-panel/95 backdrop-blur-xl border-t border-line z-30 safe-bottom">
      <div className="max-w-3xl mx-auto px-2 py-1.5 grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              onPointerDown={() => tap(HAPTIC.tick)}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl transition-all active:scale-90 ${active ? "" : "hover:bg-panel2"}`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={`transition-all ${active ? "text-accentInk" : "text-muted"}`}
                aria-hidden
              />
              <span className={`text-[11px] ${active ? "text-accentInk font-bold" : "text-muted font-semibold"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

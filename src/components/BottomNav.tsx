"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, NotebookPen, HeartPulse, Plane, User, type LucideIcon } from "lucide-react";
import { tap, HAPTIC } from "@/lib/haptic";

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home", label: "Thread", Icon: MessageCircle },
  { href: "/journal", label: "Journal", Icon: NotebookPen },
  { href: "/pulse", label: "Pulse", Icon: HeartPulse },
  { href: "/together", label: "Together", Icon: Plane },
  { href: "/profile", label: "Me", Icon: User },
];

const isOn = (href: string, path: string) => path === href || (href !== "/home" && path.startsWith(href + "/"));

export default function BottomNav() {
  const pathname = usePathname();
  // The tab you just tapped, lit immediately rather than once the screen has
  // loaded. Cleared as soon as the URL actually changes.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-panel/95 backdrop-blur-xl border-t border-line z-30 safe-bottom">
      <div className="max-w-3xl mx-auto px-2 py-1.5 grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pending ? pending === href : isOn(href, pathname);
          const loading = pending === href;
          return (
            // Prefetching is on (the default): in production Next.js loads each
            // tab's loading screen ahead of time, so a tap shows it at once.
            <Link
              key={href}
              href={href}
              onPointerDown={() => tap(HAPTIC.tick)}
              onClick={() => {
                if (!isOn(href, pathname)) setPending(href);
              }}
              aria-current={isOn(href, pathname) ? "page" : undefined}
              aria-busy={loading || undefined}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl transition-[background-color,transform] duration-150 active:scale-90 active:bg-panel2 ${active ? "" : "hover:bg-panel2"}`}
            >
              {/* A pill behind the active icon, so the change reads at a glance. */}
              <span
                aria-hidden
                className={`absolute top-1.5 h-7 w-12 rounded-full transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`}
                style={{ background: "rgb(var(--c-prim-bg) / 0.12)" }}
              />
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={`relative transition-colors duration-150 ${active ? "text-accentInk" : "text-muted"} ${loading ? "motion-safe:animate-pulse" : ""}`}
                aria-hidden
              />
              <span className={`relative text-[11px] ${active ? "text-accentInk font-bold" : "text-muted font-semibold"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

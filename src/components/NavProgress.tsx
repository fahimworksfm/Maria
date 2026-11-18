"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A thin bar across the top of the screen from the moment you tap any link in
// the app until the next screen arrives. Covers every link (tabs, the Spaces
// list, chips), not just the bottom nav.
//
// It listens for clicks on same-site links rather than wrapping each one, and
// clears when the URL changes. A safety timeout hides it if a navigation is
// abandoned, so it can never stick.
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActive(false);
    if (timer.current) clearTimeout(timer.current);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same screen (or only a #fragment change): nothing to wait for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 10_000);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      aria-hidden
      className={`fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
    >
      <div className={`h-full nav-progress-bar ${active ? "is-running" : ""}`} style={{ background: "rgb(var(--c-prim-bg))" }} />
    </div>
  );
}

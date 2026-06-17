"use client";

import { usePathname } from "next/navigation";

// Re-keys on route change so each screen gently fades/settles in. Quiet, not
// a slide-show. Reduced-motion users get an instant swap (handled in CSS).
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}

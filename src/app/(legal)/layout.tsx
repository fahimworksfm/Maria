import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="px-5 py-4 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-[-0.01em] flex items-center gap-2.5 min-h-[44px]">
          <span
            className="grid place-items-center w-8 h-8 rounded-full text-sm font-bold"
            style={{ background: "rgb(var(--c-prim-bg))", color: "rgb(var(--c-prim-fg))" }}
            aria-hidden
          >
            T
          </span>
          Tether
        </Link>
        <nav className="flex gap-1 text-sm font-semibold">
          <Link href="/terms" className="inline-flex items-center min-h-[44px] px-2 hover:text-ink text-muted">Terms</Link>
          <Link href="/privacy" className="inline-flex items-center min-h-[44px] px-2 hover:text-ink text-muted">Privacy</Link>
          <Link href="/login" className="inline-flex items-center min-h-[44px] px-2 hover:text-ink text-muted">Sign in</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-6 pb-24 pt-4">{children}</main>
    </div>
  );
}

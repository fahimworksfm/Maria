import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-xl flex items-center gap-2">
          <span className="inline-block w-6 h-6 rounded-md bg-gradient-to-br from-accent to-accent2" />
          Tether
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/terms" className="hover:text-ink text-muted">Terms</Link>
          <Link href="/privacy" className="hover:text-ink text-muted">Privacy</Link>
          <Link href="/login" className="hover:text-ink text-muted">Sign in</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-6 pb-24 pt-4">{children}</main>
    </div>
  );
}

// Editorial wrapper for the pre-auth screens: warm glow backdrop, the brand
// mark, a serif title, and a softly-lit card. Presentational only.
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-[15%] w-[130vw] h-[60vh] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgb(var(--accent) / 0.16), transparent)" }}
        />
      </div>
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <div className="text-center mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="w-12 h-12 mx-auto mb-4 rounded-2xl" />
          <h1 className="display text-3xl">{title}</h1>
          {subtitle && <p className="muted mt-2">{subtitle}</p>}
        </div>
        <div className="hero-glow card p-6">{children}</div>
        {footer && <p className="muted text-center mt-6">{footer}</p>}
      </div>
    </main>
  );
}

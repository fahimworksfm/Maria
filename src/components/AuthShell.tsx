// Wrapper for the pre-auth and pairing screens: the brand mark, a bold title
// and one card on the plain ground. Presentational only.
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
    <main className="min-h-screen flex items-center justify-center px-5 py-8 bg-bg">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <div className="text-center mb-6">
          <span
            className="grid place-items-center w-12 h-12 mx-auto mb-4 rounded-full text-lg font-bold"
            style={{ background: "rgb(var(--c-prim-bg))", color: "rgb(var(--c-prim-fg))" }}
            aria-hidden
          >
            T
          </span>
          <h1 className="display text-[1.75rem]">{title}</h1>
          {subtitle && <p className="text-muted text-[15px] mt-1.5">{subtitle}</p>}
        </div>
        <div className="card p-5">{children}</div>
        {footer && <p className="muted text-center mt-5">{footer}</p>}
      </div>
    </main>
  );
}

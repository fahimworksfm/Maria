// Shown the instant a screen inside the app is opened, while the server is
// still loading its data. Without it, Next.js keeps the previous screen frozen
// until the new one is ready, so a tap looked like it did nothing.
//
// The header and bottom nav live in the layout and stay put; only the content
// area is replaced. The shapes echo a thread: a heading, a bubble on each side,
// and a card.
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2" aria-hidden>
        <div className="h-7 w-40 rounded-lg bg-panel2 motion-safe:animate-pulse" />
        <div className="h-4 w-64 max-w-full rounded-md bg-panel2 motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-2" aria-hidden>
        <div className="h-11 w-[62%] rounded-[20px] rounded-bl-md bg-panel2 motion-safe:animate-pulse" />
        <div className="h-11 w-[48%] self-end rounded-[20px] rounded-br-md motion-safe:animate-pulse" style={{ background: "rgb(var(--c-prim-bg) / 0.18)" }} />
      </div>
      <div className="card p-4 space-y-3" aria-hidden>
        <div className="h-3 w-20 rounded bg-panel2 motion-safe:animate-pulse" />
        <div className="h-5 w-3/4 rounded-md bg-panel2 motion-safe:animate-pulse" />
        <div className="h-11 w-full rounded-xl2 bg-panel2 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

"use client";

// Small bottom toast with an Undo action. Shown after an optimistic delete; the
// real delete is deferred 5s by useCollection, so Undo just cancels it.
export default function UndoToast({
  show,
  label = "Removed",
  onUndo,
  onDismiss,
}: {
  show: boolean;
  label?: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  if (!show) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 toast-in">
      <div className="flex items-center gap-2 rounded-full border border-line bg-panel pl-4 pr-1.5 text-[15px] text-ink shadow-lift">
        <span>{label}</span>
        <button onClick={onUndo} className="min-h-[44px] px-2 font-bold text-accentInk">
          Undo
        </button>
        <button onClick={onDismiss} aria-label="Dismiss" className="grid place-items-center w-9 h-9 rounded-full text-muted hover:bg-panel2 hover:text-ink">×</button>
      </div>
    </div>
  );
}

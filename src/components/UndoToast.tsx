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
      <div className="flex items-center gap-3 rounded-full border border-line bg-panel2/95 backdrop-blur px-4 py-2 text-sm text-ink shadow-soft">
        <span>{label}</span>
        <button onClick={onUndo} className="font-medium text-accent underline underline-offset-2">
          Undo
        </button>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-muted hover:text-ink">×</button>
      </div>
    </div>
  );
}

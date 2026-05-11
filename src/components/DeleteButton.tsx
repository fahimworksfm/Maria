"use client";

import { tap, HAPTIC } from "@/lib/haptic";

export default function DeleteButton({
  confirmText = "Delete this? It can't be undone.",
  className = "btn btn-ghost text-xs",
  children = "Delete",
}: {
  confirmText?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        tap(HAPTIC.tap);
        if (!window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}

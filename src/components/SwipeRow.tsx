"use client";

import { useRef, useState } from "react";

// Swipe a row left to delete (touch/pointer). A visible affordance underneath
// shows "Delete" as you drag; past the threshold on release it fires onDelete.
// A regular delete button should still be provided elsewhere for non-touch.
export default function SwipeRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const horizontal = useRef<boolean | null>(null);

  function down(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return; // swipe is for touch; mouse uses the button
    startX.current = e.clientX;
    startY.current = e.clientY;
    horizontal.current = null;
    setDragging(true);
  }
  function move(e: React.PointerEvent) {
    if (!dragging) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;
    if (horizontal.current === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      horizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (horizontal.current) setDx(Math.min(0, deltaX)); // left only
  }
  function up() {
    if (!dragging) return;
    setDragging(false);
    if (dx < -96) onDelete();
    setDx(0);
    horizontal.current = null;
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-end pr-4 rounded-xl2 bg-accent/20 text-accent text-sm pointer-events-none">
        Release to delete
      </div>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .2s ease", touchAction: "pan-y" }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}

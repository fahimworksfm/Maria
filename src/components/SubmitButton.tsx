"use client";

import { useFormStatus } from "react-dom";

// Submit button that disables itself while the form action is in flight, so a
// slow connection can't turn one tap into several inserts.
export default function SubmitButton({
  children = "Save",
  pendingLabel = "Saving…",
  className = "btn btn-primary w-full",
  disabled = false,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

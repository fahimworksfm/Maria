// Rows added before the lists recorded an author belong to no one, so they sit
// full width. These two quiet buttons let either of you say whose a row is.
// Only "me" or "partner" is ever sent; the server works out the user id.

const BTN =
  "inline-flex items-center min-h-[44px] px-2.5 rounded-full text-[13px] font-semibold text-muted hover:text-ink hover:bg-panel2 transition";

function Prompt() {
  return <span className="text-xs text-muted">Whose is this?</span>;
}

/** For client boards: calls back with who was picked. */
export function ClaimButtons({
  partnerName, onClaim, className = "",
}: { partnerName: string; onClaim: (who: "me" | "partner") => void; className?: string }) {
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      <Prompt />
      <button type="button" className={BTN} onClick={() => onClaim("me")}>Mine</button>
      <button type="button" className={BTN} onClick={() => onClaim("partner")}>{partnerName}&apos;s</button>
    </div>
  );
}

/** For server-rendered lists: posts `id` and `who` to a server action. */
export function ClaimForm({
  action, id, partnerName, className = "",
}: { action: (formData: FormData) => Promise<void>; id: string; partnerName: string; className?: string }) {
  return (
    <form action={action} className={`flex items-center gap-1 flex-wrap ${className}`}>
      <input type="hidden" name="id" value={id} />
      <Prompt />
      <button type="submit" name="who" value="me" className={BTN}>Mine</button>
      <button type="submit" name="who" value="partner" className={BTN}>{partnerName}&apos;s</button>
    </form>
  );
}

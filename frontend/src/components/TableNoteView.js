import React from "react";
import { StickyNote } from "lucide-react";

/**
 * Read-only display of a table's session note. Only the waiter can edit it,
 * so cashier/kitchen/admin table-detail views render this passive variant.
 * Renders nothing when there's no note.
 */
export default function TableNoteView({ note }) {
  if (!note) return null;
  return (
    <div
      data-testid="table-note-readonly"
      className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2.5"
    >
      <StickyNote size={14} className="mt-0.5 shrink-0 text-amber-700" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="text-[9px] uppercase tracking-widest text-ink2 font-semibold">
          Table note
        </div>
        <div className="mt-0.5 text-amber-900">{note}</div>
      </div>
    </div>
  );
}

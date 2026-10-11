"use client";

import type { NumberedFootnote } from "./footnotes";

export default function FootnotesSection({
  notes,
  onTextChange,
  onDelete,
}: {
  notes: NumberedFootnote[];
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  if (notes.length === 0) return null;

  return (
    <div className="footnotes-section mt-8 pt-3 text-xs" style={{ borderTop: "1px solid var(--doc-border)" }}>
      <ol className="space-y-1.5">
        {notes.map((note) => (
          <li
            key={note.id}
            id={`footnote-${note.id}`}
            className="flex items-start gap-2"
          >
            <span style={{ color: "var(--doc-muted)" }} className="shrink-0 pt-1">
              {note.number}.
            </span>
            <input
              type="text"
              value={note.text}
              onChange={(e) => onTextChange(note.id, e.target.value)}
              placeholder="Note text…"
              aria-label={`Footnote ${note.number} text`}
              className="min-w-0 flex-1 bg-transparent py-1 focus:outline-none"
              style={{ color: "var(--doc-body-color)" }}
            />
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              aria-label={`Delete footnote ${note.number}`}
              className="shrink-0 text-xs opacity-60 hover:opacity-100"
              style={{ color: "var(--doc-deletion-color)" }}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

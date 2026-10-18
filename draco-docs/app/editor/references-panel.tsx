"use client";

import type { BookmarkEntry } from "./bookmark-extension";

export default function ReferencesPanel({
  bookmarks,
  onDelete,
}: {
  bookmarks: BookmarkEntry[];
  onDelete: (id: string) => void;
}) {
  return (
    <aside
      aria-label="Bookmarks"
      className="w-72 shrink-0 border-l border-slate-800 bg-slate-950 overflow-y-auto p-3"
    >
      <h2 className="text-xs font-semibold text-slate-300 mb-2">
        Bookmarks{bookmarks.length > 0 && ` (${bookmarks.length})`}
      </h2>

      {bookmarks.length === 0 ? (
        <p className="text-xs text-slate-400">
          No bookmarks yet. Use &ldquo;Insert bookmark&rdquo; to mark a spot
          you can reference later.
        </p>
      ) : (
        <ul className="space-y-1">
          {bookmarks.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 text-xs text-slate-300 px-2 py-1.5 rounded hover:bg-slate-900"
            >
              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector(`[data-bookmark-id="${b.id}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="text-left truncate hover:underline"
                title={b.name}
              >
                {b.name}
              </button>
              <button
                type="button"
                onClick={() => onDelete(b.id)}
                aria-label={`Delete bookmark ${b.name}`}
                className="shrink-0 opacity-60 hover:opacity-100 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

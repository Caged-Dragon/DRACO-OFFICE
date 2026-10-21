"use client";

import { useState } from "react";
import type { RefTarget } from "./crossref-extension";

export default function ReferenceControls({
  targets,
  onInsertBookmark,
  onInsertCrossReference,
}: {
  targets: RefTarget[];
  onInsertBookmark: (name: string) => void;
  onInsertCrossReference: (targetId: string) => void;
}) {
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [bookmarkName, setBookmarkName] = useState("");
  const [xrefOpen, setXrefOpen] = useState(false);

  const submitBookmark = () => {
    onInsertBookmark(bookmarkName.trim() || "Bookmark");
    setBookmarkName("");
    setBookmarkOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <button
          type="button"
          onClick={() => setBookmarkOpen((o) => !o)}
          className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          Insert bookmark
        </button>
        {bookmarkOpen && (
          <div className="absolute top-full left-0 mt-1 z-10 flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-1.5 shadow-lg">
            <input
              type="text"
              autoFocus
              value={bookmarkName}
              onChange={(e) => setBookmarkName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitBookmark();
                if (e.key === "Escape") setBookmarkOpen(false);
              }}
              placeholder="Bookmark name"
              aria-label="Bookmark name"
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-40 focus:outline-none"
            />
            <button
              type="button"
              onClick={submitBookmark}
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setXrefOpen((o) => !o)}
          disabled={targets.length === 0}
          title={
            targets.length === 0
              ? "Add a heading or bookmark first"
              : "Insert cross-reference"
          }
          className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors"
        >
          Insert cross-reference
        </button>
        {xrefOpen && targets.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-10 bg-slate-900 border border-slate-700 rounded-md p-1.5 shadow-lg w-56 max-h-56 overflow-y-auto">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onInsertCrossReference(t.id);
                  setXrefOpen(false);
                }}
                className="w-full text-left text-xs text-slate-300 hover:bg-slate-800 px-2 py-1.5 rounded truncate"
                title={t.label}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";

export default function CommentControls({
  editor,
  hasSelection,
  unresolvedCount,
  panelOpen,
  onTogglePanel,
  onAddComment,
}: {
  editor: Editor;
  hasSelection: boolean;
  unresolvedCount: number;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onAddComment: (quote: string, body: string) => void;
}) {
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");

  const startCompose = () => {
    if (!hasSelection) return;
    setComposing(true);
  };

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const { from, to } = editor.state.selection;
    const quote = editor.state.doc.textBetween(from, to, " ");
    onAddComment(quote, trimmed);
    setBody("");
    setComposing(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={startCompose}
        disabled={!hasSelection}
        title={
          hasSelection
            ? "Add a comment on the selected text"
            : "Select some text first"
        }
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors"
      >
        Add comment
      </button>

      <button
        type="button"
        onClick={onTogglePanel}
        aria-pressed={panelOpen}
        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
          panelOpen
            ? "bg-blue-600 text-white"
            : "bg-slate-800 hover:bg-slate-700 text-slate-200"
        }`}
      >
        Comments{unresolvedCount > 0 && ` (${unresolvedCount})`}
      </button>

      {composing && (
        <div className="absolute top-full left-0 mt-1 z-10 flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-1.5 shadow-lg">
          <input
            type="text"
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setComposing(false);
            }}
            placeholder="Write a comment…"
            aria-label="Comment text"
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-56 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            Comment
          </button>
        </div>
      )}
    </div>
  );
}

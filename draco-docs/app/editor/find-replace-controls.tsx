"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { searchPluginKey } from "./find-replace-extension";

export default function FindReplaceControls({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");

  const state = searchPluginKey.getState(editor.state);
  const matchCount = state?.matches.length ?? 0;
  const currentIndex = state?.currentIndex ?? -1;

  const runSearch = (value: string) => {
    setTerm(value);
    editor.chain().setSearchTerm(value).run();
  };

  const close = () => {
    setOpen(false);
    setTerm("");
    setReplaceTerm("");
    editor.chain().clearSearch().run();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        Find & Replace
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        autoFocus
        value={term}
        onChange={(e) => runSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.shiftKey) {
              editor.chain().findPrevious().run();
            } else {
              editor.chain().findNext().run();
            }
          }
          if (e.key === "Escape") close();
        }}
        placeholder="Find"
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-36 focus:outline-none"
      />
      <span className="text-[10px] text-slate-500 w-14">
        {matchCount > 0 ? `${currentIndex + 1} / ${matchCount}` : "0 / 0"}
      </span>
      <button
        type="button"
        title="Previous match"
        disabled={matchCount === 0}
        onClick={() => editor.chain().findPrevious().run()}
        className="text-xs px-2 py-1 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        title="Next match"
        disabled={matchCount === 0}
        onClick={() => editor.chain().findNext().run()}
        className="text-xs px-2 py-1 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-30"
      >
        ↓
      </button>

      <input
        type="text"
        value={replaceTerm}
        onChange={(e) => setReplaceTerm(e.target.value)}
        placeholder="Replace with"
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-36 focus:outline-none"
      />
      <button
        type="button"
        disabled={matchCount === 0}
        onClick={() => editor.chain().replaceCurrent(replaceTerm).run()}
        className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30"
      >
        Replace
      </button>
      <button
        type="button"
        disabled={matchCount === 0}
        onClick={() => editor.chain().replaceAll(replaceTerm).run()}
        className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30"
      >
        Replace all
      </button>

      <button
        type="button"
        onClick={close}
        className="text-xs px-2 py-1 rounded text-slate-400 hover:bg-slate-800"
      >
        ✕
      </button>
    </div>
  );
}

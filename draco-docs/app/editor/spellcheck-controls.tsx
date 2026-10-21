"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { spellCheckPluginKey, suggestFor } from "./spellcheck-extension";

export default function SpellCheckControls({ editor }: { editor: Editor }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const pluginState = spellCheckPluginKey.getState(editor.state);
  const enabled = pluginState?.enabled ?? true;
  const misspellings = pluginState?.misspellings ?? [];

  // De-duplicate by word for the panel list (a word can appear many times).
  const uniqueWords = [...new Set(misspellings.map((m) => m.word))];

  return (
    <div className="relative flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => editor.chain().toggleSpellCheck().run()}
        />
        Spell check
      </label>

      {enabled && (
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="text-xs px-2 py-1 rounded-md text-slate-300 hover:bg-slate-800"
        >
          {uniqueWords.length > 0
            ? `${uniqueWords.length} flagged`
            : "No issues"}
        </button>
      )}

      {panelOpen && enabled && uniqueWords.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-slate-900 border border-slate-700 rounded-md p-2 shadow-lg w-64 max-h-64 overflow-y-auto">
          {uniqueWords.map((word) => (
            <div
              key={word}
              className="flex items-center justify-between gap-2 py-1 border-b border-slate-800 last:border-0"
            >
              <div>
                <div className="text-xs text-slate-200 font-medium">
                  {word}
                </div>
                <div className="text-xs text-slate-400">
                  {suggestFor(word).join(", ") || "no suggestions"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => editor.chain().addWordToDictionary(word).run()}
                className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap"
              >
                Add to dictionary
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { Editor } from "@tiptap/react";

export default function ColumnsControls({ editor }: { editor: Editor }) {
  const active = editor.isActive("columnsBlock");
  const activeCount = editor.getAttributes("columnsBlock").count as
    | number
    | undefined;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={active && activeCount === 2}
        onClick={() => editor.chain().focus().setColumns(2).run()}
        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
          active && activeCount === 2
            ? "bg-blue-600 text-white"
            : "bg-slate-800 hover:bg-slate-700 text-slate-200"
        }`}
      >
        2 columns
      </button>
      <button
        type="button"
        aria-pressed={active && activeCount === 3}
        onClick={() => editor.chain().focus().setColumns(3).run()}
        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
          active && activeCount === 3
            ? "bg-blue-600 text-white"
            : "bg-slate-800 hover:bg-slate-700 text-slate-200"
        }`}
      >
        3 columns
      </button>
      {active && (
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetColumns().run()}
          className="text-xs px-3 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Remove columns
        </button>
      )}
    </div>
  );
}

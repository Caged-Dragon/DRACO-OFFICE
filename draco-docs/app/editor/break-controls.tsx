"use client";

import type { Editor } from "@tiptap/react";

export default function BreakControls({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().insertPageBreak().run()}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        Insert page break
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().insertSectionBreak().run()}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        Insert section break
      </button>
    </div>
  );
}

"use client";

import type { Editor } from "@tiptap/react";

export default function HistoryControls({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Undo"
        title="Undo (Ctrl/Cmd+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        ↶
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        className="w-8 h-8 flex items-center justify-center rounded-md text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        ↷
      </button>
    </div>
  );
}

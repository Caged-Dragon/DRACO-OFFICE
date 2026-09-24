"use client";

import type { Editor } from "@tiptap/react";

export default function ListControls({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Bullet list"
        aria-pressed={editor.isActive("bulletList")}
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
          editor.isActive("bulletList")
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800"
        }`}
      >
        •≡
      </button>

      <button
        type="button"
        aria-label="Numbered list"
        aria-pressed={editor.isActive("orderedList")}
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
          editor.isActive("orderedList")
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800"
        }`}
      >
        1≡
      </button>

      <span className="text-[10px] text-slate-600 px-1">
        Tab nests a list item, Shift+Tab un-nests it
      </span>
    </div>
  );
}

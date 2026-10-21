"use client";

import type { Editor } from "@tiptap/react";
import { STYLE_SETS, getStyleSet, type StyleSetId } from "./style-sets";

export default function StyleControls({
  editor,
  styleSet,
  onStyleSetChange,
}: {
  editor: Editor;
  styleSet: StyleSetId;
  onStyleSetChange: (id: StyleSetId) => void;
}) {
  const current = getStyleSet(styleSet);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        aria-label="Document style set"
        title={current.description}
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={current.id}
        onChange={(e) => onStyleSetChange(e.target.value as StyleSetId)}
      >
        {STYLE_SETS.map((s) => (
          <option key={s.id} value={s.id}>
            Style: {s.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Quote"
          aria-pressed={editor.isActive("blockquote")}
          title="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
            editor.isActive("blockquote")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          ❝
        </button>
        <button
          type="button"
          aria-label="Code block"
          aria-pressed={editor.isActive("codeBlock")}
          title="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-mono transition-colors ${
            editor.isActive("codeBlock")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {"</>"}
        </button>
        <button
          type="button"
          aria-label="Clear formatting"
          title="Clear formatting (keeps links)"
          onClick={() =>
            editor
              .chain()
              .focus()
              .unsetBold()
              .unsetItalic()
              .unsetUnderline()
              .unsetStrike()
              .unsetHighlight()
              .unsetColor()
              .unsetFontFamily()
              .unsetFontSize()
              .unsetLineHeight()
              .unsetTextAlign()
              .clearNodes()
              .resetAttributes("paragraph", "indentLevel")
              .run()
          }
          className="px-2 h-8 flex items-center justify-center rounded-md text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Clear formatting
        </button>
      </div>
    </div>
  );
}

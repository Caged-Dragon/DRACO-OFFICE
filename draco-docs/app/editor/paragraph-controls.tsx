"use client";

import type { Editor } from "@tiptap/react";

const ALIGNMENTS = [
  { label: "Left", value: "left", icon: "≡←" },
  { label: "Center", value: "center", icon: "≡" },
  { label: "Right", value: "right", icon: "≡→" },
  { label: "Justify", value: "justify", icon: "≣" },
] as const;

const LINE_SPACINGS = [
  { label: "1", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "2", value: "2" },
];

export default function ParagraphControls({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        {ALIGNMENTS.map((a) => (
          <button
            key={a.value}
            type="button"
            aria-label={`Align ${a.label}`}
            aria-pressed={editor.isActive({ textAlign: a.value })}
            title={`Align ${a.label}`}
            onClick={() => editor.chain().focus().setTextAlign(a.value).run()}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-xs transition-colors ${
              editor.isActive({ textAlign: a.value })
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {a.icon}
          </button>
        ))}
      </div>

      <select
        aria-label="Line spacing"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={editor.getAttributes("paragraph").lineHeight || "1.5"}
        onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
      >
        {LINE_SPACINGS.map((s) => (
          <option key={s.value} value={s.value}>
            Spacing {s.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Decrease indent"
          title="Decrease indent (Shift+Tab)"
          onClick={() => editor.chain().focus().decreaseIndent().run()}
          className="w-8 h-8 flex items-center justify-center rounded-md text-xs text-slate-300 hover:bg-slate-800"
        >
          ⇤
        </button>
        <button
          type="button"
          aria-label="Increase indent"
          title="Increase indent (Tab)"
          onClick={() => editor.chain().focus().increaseIndent().run()}
          className="w-8 h-8 flex items-center justify-center rounded-md text-xs text-slate-300 hover:bg-slate-800"
        >
          ⇥
        </button>
      </div>
    </div>
  );
}

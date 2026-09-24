"use client";

import type { Editor } from "@tiptap/react";

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "Arial, Helvetica, sans-serif" },
  { label: "Mono", value: "'Courier New', monospace" },
];

const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "Huge", value: "28px" },
];

const TEXT_COLORS = [
  "#f1f5f9", // default (slate-100)
  "#f87171", // red
  "#fb923c", // orange
  "#facc15", // yellow
  "#4ade80", // green
  "#60a5fa", // blue
  "#c084fc", // purple
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: null },
  { label: "Yellow", value: "#facc15" },
  { label: "Green", value: "#4ade80" },
  { label: "Blue", value: "#60a5fa" },
  { label: "Pink", value: "#f472b6" },
];

export default function FontControls({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        aria-label="Font family"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={editor.getAttributes("textStyle").fontFamily || ""}
        onChange={(e) => {
          const value = e.target.value;
          if (value) {
            editor.chain().focus().setFontFamily(value).run();
          } else {
            editor.chain().focus().unsetFontFamily().run();
          }
        }}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Font size"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={editor.getAttributes("textStyle").fontSize || "16px"}
        onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
      >
        {FONT_SIZES.map((s) => (
          <option key={s.label} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Text color ${color}`}
            onClick={() => editor.chain().focus().setColor(color).run()}
            className="w-5 h-5 rounded-full border border-slate-700"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLORS.map((h) => (
          <button
            key={h.label}
            type="button"
            aria-label={`Highlight ${h.label}`}
            title={h.label}
            onClick={() => {
              if (h.value) {
                editor.chain().focus().setHighlight({ color: h.value }).run();
              } else {
                editor.chain().focus().unsetHighlight().run();
              }
            }}
            className="w-5 h-5 rounded-md border border-slate-700 flex items-center justify-center text-[9px] text-slate-400"
            style={{ backgroundColor: h.value ?? "transparent" }}
          >
            {!h.value && "×"}
          </button>
        ))}
      </div>
    </div>
  );
}

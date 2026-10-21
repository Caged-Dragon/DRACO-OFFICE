"use client";

import type { Editor } from "@tiptap/react";

const BLOCK_TYPES = [
  { label: "Paragraph", value: "paragraph" },
  { label: "Heading 1", value: "1" },
  { label: "Heading 2", value: "2" },
  { label: "Heading 3", value: "3" },
  { label: "Heading 4", value: "4" },
  { label: "Heading 5", value: "5" },
  { label: "Heading 6", value: "6" },
] as const;

export default function HeadingControls({ editor }: { editor: Editor }) {
  const currentValue = (() => {
    for (let level = 1; level <= 6; level++) {
      if (editor.isActive("heading", { level })) return String(level);
    }
    return "paragraph";
  })();

  return (
    <select
      aria-label="Block type"
      className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
      value={currentValue}
      onChange={(e) => {
        const value = e.target.value;
        if (value === "paragraph") {
          editor.chain().focus().setParagraph().run();
        } else {
          editor
            .chain()
            .focus()
            .setHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
            .run();
        }
      }}
    >
      {BLOCK_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

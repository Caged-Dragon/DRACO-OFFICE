"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useState } from "react";
import FormattingToolbar from "./formatting-toolbar";

export default function DocumentEditor() {
  const [selectionInfo, setSelectionInfo] = useState({
    hasSelection: false,
    from: 0,
    to: 0,
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none focus:outline-none min-h-[70vh] px-4 py-6",
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection;
      setSelectionInfo({ hasSelection: !empty, from, to });
    },
    onTransaction: () => {
      // Re-render so toolbar button active-states (bold/italic/etc.)
      // reflect marks toggled at the current selection.
      setSelectionInfo((s) => ({ ...s }));
    },
  });

  // Initial selectionInfo state already matches a fresh editor's cursor
  // position (from: 0, to: 0, no selection), so no sync effect is needed.

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <FormattingToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Cursor / selection status bar (word count lands in v17) */}
      <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500 flex items-center gap-4">
        <span>
          {selectionInfo.hasSelection
            ? `Selection: ${selectionInfo.to - selectionInfo.from} chars`
            : `Cursor at ${selectionInfo.from}`}
        </span>
      </div>
    </div>
  );
}

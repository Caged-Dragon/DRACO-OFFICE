"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState } from "react";

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
  });

  // Keep selection state in sync on mount / editor swap.
  useEffect(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    setSelectionInfo({ hasSelection: !empty, from, to });
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Cursor / selection status bar — foundation other versions build on
          (word count in v17, formatting toolbar in v3, etc.) */}
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

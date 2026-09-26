"use client";

import type { Editor } from "@tiptap/react";

type ButtonProps = {
  onClick: () => void;
  label: string;
  disabled?: boolean;
};

function ToolbarTextButton({ onClick, label, disabled }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="text-xs px-2 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors whitespace-nowrap"
    >
      {label}
    </button>
  );
}

export default function TableControls({ editor }: { editor: Editor }) {
  const inTable = editor.isActive("table");

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <ToolbarTextButton
        label="Insert table"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      />

      {inTable && (
        <>
          <span className="w-px h-5 bg-slate-800 mx-1" />
          <ToolbarTextButton
            label="+ Col before"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          />
          <ToolbarTextButton
            label="+ Col after"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          />
          <ToolbarTextButton
            label="− Col"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          />
          <span className="w-px h-5 bg-slate-800 mx-1" />
          <ToolbarTextButton
            label="+ Row before"
            onClick={() => editor.chain().focus().addRowBefore().run()}
          />
          <ToolbarTextButton
            label="+ Row after"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          />
          <ToolbarTextButton
            label="− Row"
            onClick={() => editor.chain().focus().deleteRow().run()}
          />
          <span className="w-px h-5 bg-slate-800 mx-1" />
          <ToolbarTextButton
            label="Merge/Split"
            onClick={() => editor.chain().focus().mergeOrSplit().run()}
          />
          <ToolbarTextButton
            label="Header row"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          />
          <ToolbarTextButton
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        </>
      )}
    </div>
  );
}

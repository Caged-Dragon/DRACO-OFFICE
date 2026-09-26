"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";

export default function LinkControls({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const linkActive = editor.isActive("link");

  const applyLink = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href })
        .run();
    }
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        aria-label="Link"
        aria-pressed={linkActive}
        title="Add or edit link"
        onClick={() => {
          if (!open) setUrl(editor.getAttributes("link").href || "");
          setOpen(!open);
        }}
        className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
          linkActive
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800"
        }`}
      >
        🔗
      </button>

      {linkActive && (
        <button
          type="button"
          aria-label="Remove link"
          title="Remove link"
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
          className="w-8 h-8 flex items-center justify-center rounded-md text-xs text-slate-300 hover:bg-slate-800"
        >
          ✕
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-1.5 shadow-lg">
          <input
            type="text"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="https://example.com"
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-56 focus:outline-none"
          />
          <button
            type="button"
            onClick={applyLink}
            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

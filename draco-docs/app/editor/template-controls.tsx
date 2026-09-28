"use client";

import { useState } from "react";
import { TEMPLATES, type DocTemplate } from "./templates";

export default function TemplateControls({
  onSelect,
  hasContent,
}: {
  onSelect: (template: DocTemplate) => void;
  hasContent: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handlePick = (template: DocTemplate) => {
    if (hasContent) {
      const confirmed = window.confirm(
        `Start "${template.name}"? This replaces the current document's content.`
      );
      if (!confirmed) return;
    }
    onSelect(template);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        Templates
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-slate-900 border border-slate-700 rounded-md p-2 shadow-lg w-72">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handlePick(t)}
              className="w-full text-left px-2 py-2 rounded hover:bg-slate-800 transition-colors"
            >
              <div className="text-xs text-slate-200 font-medium">{t.name}</div>
              <div className="text-[10px] text-slate-500">{t.description}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-center mt-1 text-[10px] text-slate-500 hover:text-slate-300 py-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

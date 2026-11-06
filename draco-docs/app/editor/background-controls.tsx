"use client";

import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "./color-contrast";

// The body text color this document would actually use against a custom
// background — mirrors style-sets.ts's light-theme default body color,
// since page background is itself a light-theme-only customization (a
// custom color always reads as a "light" page regardless of the page
// theme preference, same as Word's own page-color behavior).
const ASSUMED_BODY_TEXT_COLOR = "#1e293b";

export default function BackgroundControls({
  backgroundColor,
  watermarkText,
  onChange,
}: {
  backgroundColor: string | null;
  watermarkText: string;
  onChange: (next: { backgroundColor: string | null; watermarkText: string }) => void;
}) {
  const ratio = backgroundColor
    ? contrastRatio(backgroundColor, ASSUMED_BODY_TEXT_COLOR)
    : null;
  const lowContrast = ratio !== null && ratio < WCAG_AA_NORMAL_TEXT;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Page color
        <input
          type="color"
          value={backgroundColor ?? "#ffffff"}
          onChange={(e) =>
            onChange({ backgroundColor: e.target.value, watermarkText })
          }
          aria-label="Page background color"
          className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
        />
      </label>

      {backgroundColor && (
        <button
          type="button"
          onClick={() => onChange({ backgroundColor: null, watermarkText })}
          className="text-xs px-2 py-1 rounded text-slate-400 hover:bg-slate-800"
        >
          Reset to default
        </button>
      )}

      <input
        type="text"
        value={watermarkText}
        onChange={(e) =>
          onChange({ backgroundColor, watermarkText: e.target.value })
        }
        placeholder="Watermark text (e.g. DRAFT)"
        aria-label="Watermark text"
        maxLength={60}
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200 w-48"
      />

      {lowContrast && (
        <span className="text-xs text-amber-400" role="alert">
          ⚠ Low contrast ({ratio!.toFixed(1)}:1) — text may be hard to read
          on this background.
        </span>
      )}
    </div>
  );
}

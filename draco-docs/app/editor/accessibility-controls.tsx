"use client";

import type { PageThemePreference } from "./preferences";
import type { ResolvedTheme } from "./style-sets";

const OPTIONS: { value: PageThemePreference; label: string }[] = [
  { value: "system", label: "Match system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function AccessibilityControls({
  preference,
  resolved,
  onChange,
}: {
  preference: PageThemePreference;
  resolved: ResolvedTheme;
  onChange: (next: PageThemePreference) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Page theme
        <select
          value={preference}
          onChange={(e) => onChange(e.target.value as PageThemePreference)}
          className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-slate-400" aria-live="polite">
        Showing {resolved} page
      </span>
    </div>
  );
}

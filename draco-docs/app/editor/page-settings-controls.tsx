"use client";

import type { PageSettings, PageSize, Orientation, MarginPreset } from "./page-settings";

const SIZES: PageSize[] = ["Letter", "A4", "Legal"];
const MARGINS: { label: string; value: MarginPreset }[] = [
  { label: "Narrow", value: "narrow" },
  { label: "Normal", value: "normal" },
  { label: "Moderate", value: "moderate" },
  { label: "Wide", value: "wide" },
];

export default function PageSettingsControls({
  settings,
  onChange,
}: {
  settings: PageSettings;
  onChange: (settings: PageSettings) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="Page size"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={settings.size}
        onChange={(e) =>
          onChange({ ...settings, size: e.target.value as PageSize })
        }
      >
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Page orientation"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={settings.orientation}
        onChange={(e) =>
          onChange({ ...settings, orientation: e.target.value as Orientation })
        }
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>

      <select
        aria-label="Page margins"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200"
        value={settings.margin}
        onChange={(e) =>
          onChange({ ...settings, margin: e.target.value as MarginPreset })
        }
      >
        {MARGINS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label} margins
          </option>
        ))}
      </select>
    </div>
  );
}

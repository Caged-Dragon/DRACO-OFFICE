"use client";

export default function TrackChangesControls({
  enabled,
  onToggleEnabled,
  changeCount,
  panelOpen,
  onTogglePanel,
}: {
  enabled: boolean;
  onToggleEnabled: () => void;
  changeCount: number;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <input type="checkbox" checked={enabled} onChange={onToggleEnabled} />
        Track changes
      </label>

      <button
        type="button"
        onClick={onTogglePanel}
        aria-pressed={panelOpen}
        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
          panelOpen
            ? "bg-blue-600 text-white"
            : "bg-slate-800 hover:bg-slate-700 text-slate-200"
        }`}
      >
        Changes{changeCount > 0 && ` (${changeCount})`}
      </button>
    </div>
  );
}

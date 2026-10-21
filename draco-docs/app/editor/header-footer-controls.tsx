"use client";

type HeaderFooterControlsProps = {
  header: string;
  footer: string;
  showPageNumber: boolean;
  onChange: (next: {
    header: string;
    footer: string;
    showPageNumber: boolean;
  }) => void;
};

export default function HeaderFooterControls({
  header,
  footer,
  showPageNumber,
  onChange,
}: HeaderFooterControlsProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        type="text"
        value={header}
        onChange={(e) =>
          onChange({ header: e.target.value, footer, showPageNumber })
        }
        placeholder="Header text"
        aria-label="Header text"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200 w-48"
      />
      <input
        type="text"
        value={footer}
        onChange={(e) =>
          onChange({ header, footer: e.target.value, showPageNumber })
        }
        placeholder="Footer text"
        aria-label="Footer text"
        className="bg-slate-900 border border-slate-700 rounded-md text-xs px-2 py-1.5 text-slate-200 w-48"
      />
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={showPageNumber}
          onChange={(e) =>
            onChange({ header, footer, showPageNumber: e.target.checked })
          }
        />
        Show page number
      </label>
    </div>
  );
}

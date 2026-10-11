"use client";

export default function FootnoteControls({
  onInsert,
}: {
  onInsert: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onInsert}
      className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
    >
      Insert footnote
    </button>
  );
}

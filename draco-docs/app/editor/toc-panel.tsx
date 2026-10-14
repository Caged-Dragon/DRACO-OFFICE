"use client";

import type { HeadingEntry } from "./heading-id-extension";

// Indent each level relative to the lowest level actually present, so a
// document that only uses H2/H3 doesn't show a pointless empty H1 margin.
function relativeIndent(level: number, minLevel: number): number {
  return (level - minLevel) * 12;
}

export default function TocPanel({ headings }: { headings: HeadingEntry[] }) {
  const minLevel = headings.length
    ? Math.min(...headings.map((h) => h.level))
    : 1;

  return (
    <aside
      aria-label="Table of contents"
      className="w-72 shrink-0 border-l border-slate-800 bg-slate-950 overflow-y-auto p-3"
    >
      <h2 className="text-xs font-semibold text-slate-300 mb-2">
        Table of Contents
      </h2>

      {headings.length === 0 ? (
        <p className="text-xs text-slate-400">
          Add headings to your document and they&rsquo;ll show up here.
        </p>
      ) : (
        <nav aria-label="Headings">
          <ul className="space-y-1">
            {headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: relativeIndent(h.level, minLevel) }}>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(h.id)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="text-left text-xs text-slate-300 hover:text-white hover:underline w-full truncate"
                  title={h.text || "(empty heading)"}
                >
                  {h.text || "(empty heading)"}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  );
}

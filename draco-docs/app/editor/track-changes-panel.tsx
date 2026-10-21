"use client";

import type { ChangeSummary } from "./track-changes";

function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function TrackChangesPanel({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: {
  changes: ChangeSummary[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  return (
    <aside
      aria-label="Tracked changes"
      className="w-72 shrink-0 border-l border-slate-800 bg-slate-950 overflow-y-auto p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-slate-300">
          Changes{changes.length > 0 && ` (${changes.length})`}
        </h2>
        {changes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAcceptAll}
              className="text-xs text-slate-400 hover:text-green-400"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={onRejectAll}
              className="text-xs text-slate-400 hover:text-red-400"
            >
              Reject all
            </button>
          </div>
        )}
      </div>

      {changes.length === 0 ? (
        <p className="text-xs text-slate-400">
          No pending changes. Turn on tracking and start editing.
        </p>
      ) : (
        <ul className="space-y-2">
          {changes.map((c) => (
            <li
              key={c.changeId}
              className="rounded-md border border-slate-700 bg-slate-900 p-2 text-xs"
            >
              {c.insertedText && (
                <p className="tc-insertion-chip">{c.insertedText}</p>
              )}
              {c.deletedText && (
                <p className="tc-deletion-chip">{c.deletedText}</p>
              )}
              <div className="mt-1 text-xs text-slate-400">
                {c.author} · {formatTime(c.createdAt)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAccept(c.changeId)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-green-700 text-slate-300 hover:text-white"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onReject(c.changeId)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-red-700 text-slate-300 hover:text-white"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

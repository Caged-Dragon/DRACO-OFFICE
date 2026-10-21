"use client";

import { useRef } from "react";
import { nextToolbarIndex } from "./toolbar-nav";

export type ToolbarGroup = {
  id: string;
  label: string;
  icon: string;
};

export default function SidebarRail({
  groups,
  activeId,
  onSelect,
}: {
  groups: ToolbarGroup[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const items = Array.from(
      ref.current.querySelectorAll<HTMLButtonElement>("button[data-rail-item]")
    );
    const current = items.indexOf(e.target as HTMLButtonElement);
    const next = nextToolbarIndex(e.key, current, items.length, "vertical");
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  };

  return (
    // role="toolbar" (not <nav>'s implicit "navigation") because this is a
    // group of tool-triggering buttons, not a links/navigation landmark —
    // "navigation" doesn't support aria-orientation, which this needs.
    <div
      ref={ref}
      role="toolbar"
      aria-label="Formatting tools"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className="w-14 shrink-0 flex flex-col items-center gap-0.5 overflow-y-auto border-r border-slate-800 bg-slate-900 py-2"
    >
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          data-rail-item
          aria-label={g.label}
          aria-pressed={activeId === g.id}
          title={g.label}
          onClick={() => onSelect(activeId === g.id ? null : g.id)}
          className={`w-10 h-10 flex items-center justify-center rounded-md text-sm transition-colors ${
            activeId === g.id
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {g.icon}
        </button>
      ))}
    </div>
  );
}

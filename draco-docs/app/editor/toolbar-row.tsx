"use client";

import { useRef } from "react";
import { nextToolbarIndex, ownsArrowKeys } from "./toolbar-nav";

const FOCUSABLE =
  'button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"])';

/**
 * A labelled toolbar row. Screen readers announce it as a toolbar with its
 * name, and keyboard users can move between its controls with the arrow keys
 * (Tab still works everywhere, so nothing becomes harder to reach).
 */
export default function ToolbarRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLInputElement;
    if (ownsArrowKeys(target)) return;
    if (!ref.current) return;

    const items = Array.from(
      ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    ).filter((el) => el.getClientRects().length > 0); // skip hidden controls

    const next = nextToolbarIndex(e.key, items.indexOf(target), items.length);
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`border-b border-slate-800 px-4 py-2 ${className}`}
    >
      {children}
    </div>
  );
}

"use client";

import { useRef } from "react";
import { nextToolbarIndex, ownsArrowKeys } from "./toolbar-nav";

const FOCUSABLE =
  'button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"])';

/**
 * A labelled toolbar container. Screen readers announce it as a toolbar
 * with its name, and keyboard users can move between its controls with the
 * arrow keys (Tab still works everywhere, so nothing becomes harder to
 * reach). No default chrome (border/padding) is baked in — the caller fully
 * controls layout via `className`, since this now lives inside a sidebar
 * panel rather than a fixed top row.
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
      className={className}
    >
      {children}
    </div>
  );
}

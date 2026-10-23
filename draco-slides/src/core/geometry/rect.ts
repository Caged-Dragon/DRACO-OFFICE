import type { Size } from "./viewport";

/** Rectangle in slide coordinates (see viewport.ts). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_OBJECT_SIZE = 20;
export const MAX_OBJECT_SIZE = 20000;
/** At least this much of an object must stay inside the slide so it can never be lost off the edge. */
export const MIN_VISIBLE = 20;

export type HandleId = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export const HANDLE_IDS: readonly HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function moveRect(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: r.x + dx, y: r.y + dy };
}

/**
 * Resizes from `origin` by dragging `handle` by (dx, dy) in slide units. The edge opposite the handle
 * stays fixed, including when the minimum size is reached.
 */
export function resizeRect(origin: Rect, handle: HandleId, dx: number, dy: number, min = MIN_OBJECT_SIZE): Rect {
  let { x, y, width, height } = origin;
  if (handle.includes("e")) width = Math.max(min, origin.width + dx);
  if (handle.includes("w")) {
    width = Math.max(min, origin.width - dx);
    x = origin.x + origin.width - width;
  }
  if (handle.includes("s")) height = Math.max(min, origin.height + dy);
  if (handle.includes("n")) {
    height = Math.max(min, origin.height - dy);
    y = origin.y + origin.height - height;
  }
  return { x, y, width, height };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Enforces size limits and keeps part of the object on the slide. Values are rounded to 2 decimals. */
export function constrainRect(r: Rect, slide: Size): Rect {
  const width = clamp(r.width, MIN_OBJECT_SIZE, MAX_OBJECT_SIZE);
  const height = clamp(r.height, MIN_OBJECT_SIZE, MAX_OBJECT_SIZE);
  return {
    x: round2(clamp(r.x, MIN_VISIBLE - width, slide.width - MIN_VISIBLE)),
    y: round2(clamp(r.y, MIN_VISIBLE - height, slide.height - MIN_VISIBLE)),
    width: round2(width),
    height: round2(height),
  };
}

export const isFiniteRect = (r: Rect): boolean =>
  [r.x, r.y, r.width, r.height].every((v) => Number.isFinite(v));

export const rectsEqual = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Where a handle sits on a rectangle, as fractions of its width and height. */
export function handleFraction(h: HandleId): { fx: number; fy: number } {
  return { fx: h.includes("w") ? 0 : h.includes("e") ? 1 : 0.5, fy: h.includes("n") ? 0 : h.includes("s") ? 1 : 0.5 };
}

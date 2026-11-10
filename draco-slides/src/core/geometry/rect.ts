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

export interface ResizeOptions {
  /** Minimum width and height. */
  min?: number;
  /** Override the minimum for one axis (used when resizing several objects at once). */
  minWidth?: number;
  minHeight?: number;
  /** Corner handles only: keep the original width-to-height ratio. */
  keepAspect?: boolean;
  /** Resize around the center: the opposite edge moves the other way by the same amount. */
  fromCenter?: boolean;
}

/**
 * Resizes from `origin` by dragging `handle` by (dx, dy) in slide units. By default the edge opposite the handle
 * stays fixed, including when the minimum size is reached.
 */
export function resizeRect(origin: Rect, handle: HandleId, dx: number, dy: number, opts: ResizeOptions = {}): Rect {
  const min = opts.min ?? MIN_OBJECT_SIZE;
  const minW = opts.minWidth ?? min;
  const minH = opts.minHeight ?? min;
  const sx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const sy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const k = opts.fromCenter ? 2 : 1;
  let width = sx === 0 ? origin.width : Math.max(minW, origin.width + sx * dx * k);
  let height = sy === 0 ? origin.height : Math.max(minH, origin.height + sy * dy * k);
  if (opts.keepAspect && sx !== 0 && sy !== 0 && origin.width > 0 && origin.height > 0) {
    const scale = Math.max(width / origin.width, height / origin.height, minW / origin.width, minH / origin.height);
    width = origin.width * scale;
    height = origin.height * scale;
  }
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;
  return {
    x: opts.fromCenter ? cx - width / 2 : sx === -1 ? origin.x + origin.width - width : origin.x,
    y: opts.fromCenter ? cy - height / 2 : sy === -1 ? origin.y + origin.height - height : origin.y,
    width,
    height,
  };
}

/** For Shift-dragging: keep only the larger of the two movements, so an object slides along one axis. */
export function lockAxis(dx: number, dy: number): [number, number] {
  return Math.abs(dx) >= Math.abs(dy) ? [dx, 0] : [0, dy];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Enforces size limits and keeps part of the object on the slide. Values are rounded to two decimals. `min` is the
 * smallest allowed size (20 x 20 by default; flat lines allow 0). An object thinner than MIN_VISIBLE on an axis only
 * needs to stay entirely on the slide along that axis.
 */
export function constrainRect(r: Rect, slide: Size, min: { width: number; height: number } = { width: MIN_OBJECT_SIZE, height: MIN_OBJECT_SIZE }): Rect {
  const width = clamp(r.width, min.width, MAX_OBJECT_SIZE);
  const height = clamp(r.height, min.height, MAX_OBJECT_SIZE);
  const visW = Math.min(MIN_VISIBLE, width);
  const visH = Math.min(MIN_VISIBLE, height);
  return {
    x: round2(clamp(r.x, visW - width, slide.width - visW)),
    y: round2(clamp(r.y, visH - height, slide.height - visH)),
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

import { MIN_OBJECT_SIZE, type HandleId, type Rect } from "./rect";
import type { Size } from "./viewport";

/** A line drawn while dragging to show an alignment. `position` is x for vertical guides and y for horizontal ones. */
export interface Guide {
  orientation: "vertical" | "horizontal";
  position: number;
  /** Extent along the other axis. */
  from: number;
  to: number;
}

export interface SnapOptions {
  slide: Size;
  /** Other objects on the slide (not the one being dragged). */
  others: Rect[];
  /** Snap to the slide's edges and center and to other objects' edges and centers. */
  objects: boolean;
  /** Grid spacing in slide pixels, or null for no grid snapping. */
  grid: number | null;
  /** How close (slide pixels) an edge must be before it snaps. */
  threshold: number;
  /** Smallest size a resize snap may leave (20 x 20 by default). */
  minSize?: { width: number; height: number };
}

export interface SnapResult {
  rect: Rect;
  guides: Guide[];
}

interface Target {
  value: number;
  kind: "slide" | "object" | "grid";
  rect?: Rect;
}

const EPS = 1e-6;
const edgesX = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
const edgesY = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];

function targets(axis: "x" | "y", o: SnapOptions): Target[] {
  if (!o.objects) return [];
  const size = axis === "x" ? o.slide.width : o.slide.height;
  const out: Target[] = [0, size / 2, size].map((value) => ({ value, kind: "slide" as const }));
  for (const r of o.others) for (const value of axis === "x" ? edgesX(r) : edgesY(r)) out.push({ value, kind: "object", rect: r });
  return out;
}

/** The closest target within the threshold. Exact ties prefer slide and object targets over the grid. */
function bestSnap(anchors: number[], tgts: Target[], gridAnchors: number[], o: SnapOptions): { delta: number; target: Target } | null {
  let best: { delta: number; target: Target } | null = null;
  const consider = (anchor: number, t: Target) => {
    const delta = t.value - anchor;
    const dist = Math.abs(delta);
    if (dist > o.threshold) return;
    if (!best) best = { delta, target: t };
    else {
      const bd = Math.abs(best.delta);
      if (dist < bd - EPS || (Math.abs(dist - bd) <= EPS && best.target.kind === "grid" && t.kind !== "grid")) best = { delta, target: t };
    }
  };
  for (const a of anchors) for (const t of tgts) consider(a, t);
  if (o.grid && o.grid > 0) for (const a of gridAnchors) consider(a, { value: Math.round(a / o.grid) * o.grid, kind: "grid" });
  return best;
}

/**
 * Guides for every edge or center of `rect` that lines up exactly with the slide or another object.
 * Used while dragging, so users also see alignments they reached without snapping.
 */
export function alignmentGuides(rect: Rect, o: Pick<SnapOptions, "slide" | "others" | "objects">): Guide[] {
  if (!o.objects) return [];
  const guides = new Map<string, Guide>();
  const add = (orientation: Guide["orientation"], position: number, from: number, to: number) => {
    const key = `${orientation}:${Math.round(position * 100)}`;
    const g = guides.get(key);
    if (g) {
      g.from = Math.min(g.from, from);
      g.to = Math.max(g.to, to);
    } else guides.set(key, { orientation, position, from, to });
  };
  const slideRect: Rect = { x: 0, y: 0, width: o.slide.width, height: o.slide.height };
  const others = [slideRect, ...o.others];
  for (const t of others) {
    const isSlide = t === slideRect;
    // vertical guides: an x of the rect equals an x of the target
    for (const a of edgesX(rect)) {
      for (const b of edgesX(t)) {
        if (Math.abs(a - b) <= 0.01) {
          const from = isSlide ? 0 : Math.min(rect.y, t.y);
          const to = isSlide ? o.slide.height : Math.max(rect.y + rect.height, t.y + t.height);
          add("vertical", b, from, to);
        }
      }
    }
    for (const a of edgesY(rect)) {
      for (const b of edgesY(t)) {
        if (Math.abs(a - b) <= 0.01) {
          const from = isSlide ? 0 : Math.min(rect.x, t.x);
          const to = isSlide ? o.slide.width : Math.max(rect.x + rect.width, t.x + t.width);
          add("horizontal", b, from, to);
        }
      }
    }
  }
  return [...guides.values()];
}

/** Snaps a rectangle that is being moved: its left, center and right (and top, middle, bottom) to the nearest target. */
export function snapMove(rect: Rect, o: SnapOptions): SnapResult {
  const bx = bestSnap(edgesX(rect), targets("x", o), [rect.x], o);
  const by = bestSnap(edgesY(rect), targets("y", o), [rect.y], o);
  const out: Rect = { ...rect, x: rect.x + (bx?.delta ?? 0), y: rect.y + (by?.delta ?? 0) };
  return { rect: out, guides: alignmentGuides(out, o) };
}

/**
 * Snaps the edges that a resize handle is moving. Edges that are not being dragged never move, and a snap that
 * would make the box smaller than the minimum size is ignored.
 */
export function snapResize(rect: Rect, handle: HandleId, o: SnapOptions): SnapResult {
  let { x, y, width, height } = rect;
  if (handle.includes("e") || handle.includes("w")) {
    const east = handle.includes("e");
    const edge = east ? x + width : x;
    const snap = bestSnap([edge], targets("x", o), [edge], o);
    if (snap) {
      const nextWidth = east ? width + snap.delta : width - snap.delta;
      if (nextWidth >= (o.minSize?.width ?? MIN_OBJECT_SIZE)) {
        if (!east) x += snap.delta;
        width = nextWidth;
      }
    }
  }
  if (handle.includes("n") || handle.includes("s")) {
    const south = handle.includes("s");
    const edge = south ? y + height : y;
    const snap = bestSnap([edge], targets("y", o), [edge], o);
    if (snap) {
      const nextHeight = south ? height + snap.delta : height - snap.delta;
      if (nextHeight >= (o.minSize?.height ?? MIN_OBJECT_SIZE)) {
        if (!south) y += snap.delta;
        height = nextHeight;
      }
    }
  }
  const out = { x, y, width, height };
  return { rect: out, guides: alignmentGuides(out, o) };
}

/**
 * Canvas coordinate system.
 *
 * - Slide coordinates: slide pixels, origin at the slide's top-left, x right, y down. Object x/y/width/height live here.
 * - Screen coordinates: CSS pixels relative to the top-left of the canvas viewport element.
 *
 *   screen = pan + slide * zoom        slide = (screen - pan) / zoom
 *
 * `pan` is where the slide's top-left corner appears on screen.
 */
export interface Size {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface View {
  zoom: number;
  panX: number;
  panY: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
export const FIT_PADDING = 32;
/** How much of the slide must stay inside the viewport when panning. */
export const PAN_MARGIN = 48;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function centeredView(viewport: Size, slide: Size, zoom: number): View {
  return {
    zoom,
    panX: (viewport.width - slide.width * zoom) / 2,
    panY: (viewport.height - slide.height * zoom) / 2,
  };
}

/** Largest zoom at which the whole slide (plus padding) fits the viewport, centered. */
export function fitView(viewport: Size, slide: Size, padding = FIT_PADDING): View {
  const availW = Math.max(1, viewport.width - 2 * padding);
  const availH = Math.max(1, viewport.height - 2 * padding);
  const zoom = clampZoom(Math.min(availW / slide.width, availH / slide.height));
  return centeredView(viewport, slide, zoom);
}

/** Change zoom while keeping the slide point under `anchor` (a screen point) fixed. */
export function zoomAt(view: View, newZoom: number, anchor: Point): View {
  const zoom = clampZoom(newZoom);
  const sx = (anchor.x - view.panX) / view.zoom;
  const sy = (anchor.y - view.panY) / view.zoom;
  return { zoom, panX: anchor.x - sx * zoom, panY: anchor.y - sy * zoom };
}

/** Keep at least PAN_MARGIN px of the slide visible on every side so it can never be lost off-screen. */
export function clampPan(view: View, viewport: Size, slide: Size, margin = PAN_MARGIN): View {
  const minX = margin - slide.width * view.zoom;
  const maxX = viewport.width - margin;
  const minY = margin - slide.height * view.zoom;
  const maxY = viewport.height - margin;
  return {
    ...view,
    panX: Math.min(Math.max(view.panX, Math.min(minX, maxX)), Math.max(minX, maxX)),
    panY: Math.min(Math.max(view.panY, Math.min(minY, maxY)), Math.max(minY, maxY)),
  };
}

export function screenToSlide(p: Point, view: View): Point {
  return { x: (p.x - view.panX) / view.zoom, y: (p.y - view.panY) / view.zoom };
}

export function slideToScreen(p: Point, view: View): Point {
  return { x: view.panX + p.x * view.zoom, y: view.panY + p.y * view.zoom };
}

/** Next preset above (dir 1) or below (dir -1) the current zoom. */
export function nextZoomStep(zoom: number, dir: 1 | -1): number {
  if (dir === 1) return ZOOM_STEPS.find((s) => s > zoom * 1.001) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((s) => s < zoom / 1.001) ?? MIN_ZOOM;
}

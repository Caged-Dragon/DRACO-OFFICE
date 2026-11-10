import { MIN_OBJECT_SIZE } from "../geometry/rect";
import type { ShapeKind, ShapeStyle } from "./types";

export const SHAPE_KINDS: readonly ShapeKind[] = ["rectangle", "roundRect", "ellipse", "line"];
export const MAX_STROKE_WIDTH = 100;
/** A line is never made shorter than this (slide pixels), so it cannot vanish. */
export const MIN_LINE_LENGTH = 10;
export const SHAPE_FILL = "#4472c4";
export const SHAPE_STROKE = "#2f528f";

/** Name and default size for each shape the Insert tab offers. A line is flat: its box has no height. */
export const SHAPE_INFO: Record<ShapeKind, { label: string; width: number; height: number }> = {
  rectangle: { label: "Rectangle", width: 240, height: 140 },
  roundRect: { label: "Rounded rectangle", width: 240, height: 140 },
  ellipse: { label: "Oval", width: 200, height: 140 },
  line: { label: "Line", width: 240, height: 0 },
};

/** What a plain text box or placeholder looks like: a rectangle with no fill and no outline. */
export const defaultShapeStyle = (): ShapeStyle => ({ shape: "rectangle", fill: null, stroke: null, strokeWidth: 2, flipV: false });

/** Style of a newly inserted shape. Lines get an outline only. */
export function newShapeStyle(shape: ShapeKind): ShapeStyle {
  return shape === "line"
    ? { shape, fill: null, stroke: SHAPE_STROKE, strokeWidth: 3, flipV: false }
    : { shape, fill: SHAPE_FILL, stroke: SHAPE_STROKE, strokeWidth: 2, flipV: false };
}

/** Smallest width and height an object may have. A line may be flat on one axis. */
export function minSize(o: { shape: ShapeKind }): { width: number; height: number } {
  return o.shape === "line" ? { width: 0, height: 0 } : { width: MIN_OBJECT_SIZE, height: MIN_OBJECT_SIZE };
}

/** Corner radius of a rounded rectangle: a sixth of its shorter side, like PowerPoint's default. */
export const cornerRadius = (width: number, height: number): number => Math.min(width, height) / 6;

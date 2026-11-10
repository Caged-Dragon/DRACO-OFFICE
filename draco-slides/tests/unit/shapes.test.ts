import { describe, expect, it } from "vitest";
import { createPresentation, createShape } from "../../src/core/document-model/factory";
import { minBoundsSize } from "../../src/core/document-model/groups";
import {
  MAX_STROKE_WIDTH,
  MIN_LINE_LENGTH,
  SHAPE_FILL,
  SHAPE_INFO,
  SHAPE_KINDS,
  SHAPE_STROKE,
  cornerRadius,
  defaultShapeStyle,
  minSize,
  newShapeStyle,
} from "../../src/core/document-model/shapes";
import { MIN_OBJECT_SIZE, constrainRect, resizeRect } from "../../src/core/geometry/rect";
import { snapResize } from "../../src/core/geometry/snap";
import { parsePresentation } from "../../src/core/serialization/migrate";

const slide = { width: 960, height: 540 };

describe("shape definitions", () => {
  it("offers rectangle, rounded rectangle, ellipse and line, each with a label and size", () => {
    expect([...SHAPE_KINDS]).toEqual(["rectangle", "roundRect", "ellipse", "line"]);
    expect(SHAPE_INFO.rectangle).toMatchObject({ label: "Rectangle", width: 240, height: 140 });
    expect(SHAPE_INFO.ellipse.label).toBe("Oval");
    expect(SHAPE_INFO.line.height).toBe(0); // a line is flat
    expect(MAX_STROKE_WIDTH).toBe(100);
    expect(MIN_LINE_LENGTH).toBe(10);
  });

  it("plain objects draw nothing; new closed shapes are filled and outlined; lines only have an outline", () => {
    expect(defaultShapeStyle()).toMatchObject({ shape: "rectangle", fill: null, stroke: null });
    expect(newShapeStyle("ellipse")).toMatchObject({ shape: "ellipse", fill: SHAPE_FILL, stroke: SHAPE_STROKE, strokeWidth: 2, flipV: false });
    expect(newShapeStyle("line")).toMatchObject({ shape: "line", fill: null, stroke: SHAPE_STROKE, strokeWidth: 3 });
  });

  it("minimum size: 20 x 20, except flat lines", () => {
    expect(minSize({ shape: "rectangle" })).toEqual({ width: MIN_OBJECT_SIZE, height: MIN_OBJECT_SIZE });
    expect(minSize({ shape: "roundRect" })).toEqual({ width: 20, height: 20 });
    expect(minSize({ shape: "line" })).toEqual({ width: 0, height: 0 });
  });

  it("a rounded rectangle's corner is a sixth of its shorter side", () => {
    expect(cornerRadius(240, 120)).toBe(20);
    expect(cornerRadius(60, 600)).toBe(10);
  });
});

describe("createShape", () => {
  const rect = { x: 10, y: 20, width: 240, height: 140 };

  it("makes a filled, outlined shape with centered white text", () => {
    const s = createShape("rectangle", "Rectangle 1", rect);
    expect(s).toMatchObject({ role: "shape", name: "Rectangle 1", shape: "rectangle", fill: SHAPE_FILL, text: "", color: "#ffffff", align: "center", verticalAlign: "middle", overflow: "hidden", groupId: null, locked: false, visible: true });
    expect(s).toMatchObject(rect);
    expect(s.id).toMatch(/[0-9a-f-]{36}/);
  });

  it("makes lines top-aligned with visible overflow and no fill", () => {
    const l = createShape("line", "Line 1", { x: 0, y: 0, width: 240, height: 0 });
    expect(l).toMatchObject({ shape: "line", fill: null, verticalAlign: "top", overflow: "visible", height: 0 });
  });

  it("every kind validates as part of a presentation", () => {
    const p = createPresentation("S");
    for (const kind of SHAPE_KINDS) {
      const info = SHAPE_INFO[kind];
      p.slides[0].objects.push(createShape(kind, info.label, { x: 100, y: 100, width: info.width, height: info.height }));
    }
    expect(parsePresentation(p).ok).toBe(true);
  });
});

describe("geometry for flat objects", () => {
  it("constrainRect lets a line be flat on one axis and keeps it on the slide", () => {
    const min = minSize({ shape: "line" });
    expect(constrainRect({ x: 100, y: 270, width: 240, height: 0 }, slide, min)).toEqual({ x: 100, y: 270, width: 240, height: 0 });
    expect(constrainRect({ x: 5, y: 5, width: 0, height: 100 }, slide, min)).toMatchObject({ x: 5, y: 5 }); // a vertical line near the edge is on the slide
    expect(constrainRect({ x: -50, y: 10, width: 0, height: 100 }, slide, min).x).toBe(0);
    expect(constrainRect({ x: 5000, y: 600, width: 0, height: 0 }, slide, min)).toMatchObject({ x: 960, y: 540 });
  });

  it("constrainRect still enforces 20 x 20 and 20 px visible for ordinary objects", () => {
    expect(constrainRect({ x: 0, y: 0, width: 1, height: 1 }, slide)).toMatchObject({ width: 20, height: 20 });
    expect(constrainRect({ x: 5000, y: 0, width: 300, height: 80 }, slide).x).toBe(940);
  });

  it("resizeRect with locked proportions does not divide by zero for flat boxes", () => {
    const flat = { x: 0, y: 0, width: 240, height: 0 };
    const out = resizeRect(flat, "se", 10, 10, { keepAspect: true, minWidth: 0, minHeight: 0 });
    expect(Number.isFinite(out.width) && Number.isFinite(out.height)).toBe(true);
    expect(out).toMatchObject({ width: 250, height: 10 });
  });

  it("minBoundsSize honours per-object minimums, so a flat line imposes none", () => {
    const rects = [{ x: 0, y: 0, width: 240, height: 0 }, { x: 0, y: 50, width: 100, height: 100 }];
    const bounds = { x: 0, y: 0, width: 240, height: 150 };
    const mins = [minSize({ shape: "line" }), minSize({ shape: "rectangle" })];
    const m = minBoundsSize(rects, bounds, mins);
    expect(m.width).toBeCloseTo((20 / 100) * 240, 9); // set by the rectangle only
    expect(m.height).toBeCloseTo((20 / 100) * 150, 9);
    expect(minBoundsSize([rects[0]], rects[0], [minSize({ shape: "line" })])).toEqual({ width: 0, height: 0 });
  });

  it("snapResize honours a smaller minimum size for lines", () => {
    const o = { slide, others: [{ x: 104, y: 0, width: 100, height: 10 }], objects: true, grid: null, threshold: 6, minSize: { width: 0, height: 0 } };
    const rect = { x: 100, y: 400, width: 21, height: 0 };
    expect(snapResize(rect, "w", o).rect).toMatchObject({ x: 104, width: 17 }); // allowed for a line (would be refused for a box)
    expect(snapResize(rect, "w", { ...o, minSize: undefined }).rect).toEqual(rect);
  });
});

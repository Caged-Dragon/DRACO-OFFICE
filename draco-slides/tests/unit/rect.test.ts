import { describe, expect, it } from "vitest";
import {
  HANDLE_IDS,
  MIN_OBJECT_SIZE,
  MIN_VISIBLE,
  constrainRect,
  handleFraction,
  isFiniteRect,
  lockAxis,
  moveRect,
  rectsEqual,
  resizeRect,
  type HandleId,
} from "../../src/core/geometry/rect";

const r = { x: 100, y: 100, width: 200, height: 100 };
const slide = { width: 960, height: 540 };

describe("moveRect", () => {
  it("translates without changing size", () => {
    expect(moveRect(r, 10, -20)).toEqual({ x: 110, y: 80, width: 200, height: 100 });
  });
});

describe("resizeRect", () => {
  it("each handle changes the right edges and keeps the opposite ones fixed", () => {
    const cases: [HandleId, number, number, ReturnType<typeof resizeRect>][] = [
      ["e", 30, 99, { x: 100, y: 100, width: 230, height: 100 }],
      ["s", 99, 30, { x: 100, y: 100, width: 200, height: 130 }],
      ["se", 30, 20, { x: 100, y: 100, width: 230, height: 120 }],
      ["w", 30, 99, { x: 130, y: 100, width: 170, height: 100 }],
      ["n", 99, 30, { x: 100, y: 130, width: 200, height: 70 }],
      ["nw", 30, 20, { x: 130, y: 120, width: 170, height: 80 }],
      ["ne", 30, 20, { x: 100, y: 120, width: 230, height: 80 }],
      ["sw", 30, 20, { x: 130, y: 100, width: 170, height: 120 }],
    ];
    for (const [h, dx, dy, expected] of cases) expect(resizeRect(r, h, dx, dy), h).toEqual(expected);
  });

  it("stops at the minimum size and keeps the opposite edge in place", () => {
    const w = resizeRect(r, "w", 5000, 0);
    expect(w.width).toBe(MIN_OBJECT_SIZE);
    expect(w.x + w.width).toBe(r.x + r.width);
    const n = resizeRect(r, "n", 0, 5000);
    expect(n.height).toBe(MIN_OBJECT_SIZE);
    expect(n.y + n.height).toBe(r.y + r.height);
    expect(resizeRect(r, "e", -5000, 0).width).toBe(MIN_OBJECT_SIZE);
  });

  it("can grow past the starting size in both directions of a handle", () => {
    expect(resizeRect(r, "w", -50, 0)).toMatchObject({ x: 50, width: 250 });
  });
});

describe("constrainRect", () => {
  it("keeps at least MIN_VISIBLE px on the slide on every side", () => {
    const far = constrainRect({ x: 5000, y: 5000, width: 300, height: 80 }, slide);
    expect(far.x).toBe(slide.width - MIN_VISIBLE);
    expect(far.y).toBe(slide.height - MIN_VISIBLE);
    const near = constrainRect({ x: -5000, y: -5000, width: 300, height: 80 }, slide);
    expect(near.x).toBe(MIN_VISIBLE - 300);
    expect(near.y).toBe(MIN_VISIBLE - 80);
  });

  it("enforces size limits and rounds to two decimals", () => {
    expect(constrainRect({ x: 0, y: 0, width: 1, height: 1 }, slide)).toMatchObject({ width: 20, height: 20 });
    expect(constrainRect({ x: 0, y: 0, width: 1e9, height: 5 }, slide)).toMatchObject({ width: 20000, height: 20 });
    expect(constrainRect({ x: 10.123456, y: 20.987654, width: 100.557, height: 50 }, slide)).toMatchObject({
      x: 10.12,
      y: 20.99,
      width: 100.56,
    });
  });

  it("leaves a valid rectangle alone", () => {
    expect(constrainRect(r, slide)).toEqual(r);
  });
});

describe("helpers", () => {
  it("checks finiteness and equality", () => {
    expect(isFiniteRect(r)).toBe(true);
    expect(isFiniteRect({ ...r, x: Number.NaN })).toBe(false);
    expect(isFiniteRect({ ...r, width: Number.POSITIVE_INFINITY })).toBe(false);
    expect(rectsEqual(r, { ...r })).toBe(true);
    expect(rectsEqual(r, { ...r, y: 101 })).toBe(false);
  });

  it("places handles on the edges and corners", () => {
    expect(HANDLE_IDS).toHaveLength(8);
    expect(handleFraction("nw")).toEqual({ fx: 0, fy: 0 });
    expect(handleFraction("se")).toEqual({ fx: 1, fy: 1 });
    expect(handleFraction("n")).toEqual({ fx: 0.5, fy: 0 });
    expect(handleFraction("e")).toEqual({ fx: 1, fy: 0.5 });
  });
});

describe("resizeRect options", () => {
  const box = { x: 100, y: 100, width: 300, height: 80 };

  it("keepAspect scales both sides by the larger change on corner handles, anchored at the opposite corner", () => {
    const grown = resizeRect(box, "se", 30, 0, { keepAspect: true });
    expect(grown.x).toBe(100);
    expect(grown.y).toBe(100);
    expect(grown.width).toBeCloseTo(330, 9);
    expect(grown.height).toBeCloseTo(88, 9);
    const nw = resizeRect(box, "nw", -30, 0, { keepAspect: true }); // dragging left grows from the top-left
    expect(nw.width).toBeCloseTo(330, 9);
    expect(nw.height).toBeCloseTo(88, 9);
    expect(nw.x + nw.width).toBeCloseTo(400, 9); // right edge fixed
    expect(nw.y + nw.height).toBeCloseTo(180, 9); // bottom edge fixed
  });

  it("keepAspect keeps the ratio and the minimum size when shrinking a lot", () => {
    const r = resizeRect(box, "se", -5000, -5000, { keepAspect: true });
    expect(r.width).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
    expect(r.height).toBeGreaterThanOrEqual(MIN_OBJECT_SIZE);
    expect(r.width / r.height).toBeCloseTo(300 / 80, 6);
  });

  it("keepAspect does nothing for edge handles", () => {
    expect(resizeRect(box, "e", 30, 40, { keepAspect: true })).toEqual({ x: 100, y: 100, width: 330, height: 80 });
  });

  it("fromCenter moves the opposite edge the other way by the same amount", () => {
    expect(resizeRect(box, "e", 30, 0, { fromCenter: true })).toEqual({ x: 70, y: 100, width: 360, height: 80 });
    expect(resizeRect(box, "w", 30, 0, { fromCenter: true })).toEqual({ x: 130, y: 100, width: 240, height: 80 });
    expect(resizeRect(box, "se", 10, 5, { fromCenter: true })).toEqual({ x: 90, y: 95, width: 320, height: 90 });
  });

  it("fromCenter keeps the center when the minimum size is reached", () => {
    const r = resizeRect(box, "e", -5000, 0, { fromCenter: true });
    expect(r.width).toBe(MIN_OBJECT_SIZE);
    expect(r.x + r.width / 2).toBe(250);
  });

  it("a custom minimum is honoured", () => {
    expect(resizeRect(box, "e", -5000, 0, { min: 50 }).width).toBe(50);
  });
});

describe("lockAxis", () => {
  it("keeps the larger movement", () => {
    expect(lockAxis(10, 3)).toEqual([10, 0]);
    expect(lockAxis(-2, 9)).toEqual([0, 9]);
    expect(lockAxis(5, 5)).toEqual([5, 0]);
    expect(lockAxis(0, 0)).toEqual([0, 0]);
  });
});


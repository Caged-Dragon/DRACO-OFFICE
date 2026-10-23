import { describe, expect, it } from "vitest";
import {
  HANDLE_IDS,
  MIN_OBJECT_SIZE,
  MIN_VISIBLE,
  constrainRect,
  handleFraction,
  isFiniteRect,
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

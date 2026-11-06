import { describe, expect, it } from "vitest";
import { alignmentGuides, snapMove, snapResize, type SnapOptions } from "../../src/core/geometry/snap";

const A = { x: 100, y: 100, width: 200, height: 100 };
const base: SnapOptions = { slide: { width: 960, height: 540 }, others: [A], objects: true, grid: null, threshold: 6 };

describe("snapMove", () => {
  it("snaps an edge to another object's edge and draws a guide spanning both", () => {
    const r = snapMove({ x: 104, y: 300, width: 50, height: 50 }, base);
    expect(r.rect).toEqual({ x: 100, y: 300, width: 50, height: 50 });
    expect(r.guides).toEqual([{ orientation: "vertical", position: 100, from: 100, to: 350 }]);
  });

  it("snaps a center to the slide center", () => {
    const r = snapMove({ x: 428, y: 20, width: 100, height: 40 }, base); // center 478 -> 480
    expect(r.rect.x).toBe(430);
    expect(r.guides).toContainEqual({ orientation: "vertical", position: 480, from: 0, to: 540 });
  });

  it("snaps both axes independently", () => {
    const r = snapMove({ x: 297, y: 97, width: 40, height: 40 }, base); // left 297 -> 300, top 97 -> 100
    expect(r.rect).toMatchObject({ x: 300, y: 100 });
    expect(r.guides.map((g) => g.orientation).sort()).toEqual(["horizontal", "vertical"]);
  });

  it("leaves the rectangle alone when nothing is within the threshold", () => {
    const r = snapMove({ x: 600, y: 400, width: 50, height: 50 }, base);
    expect(r.rect).toEqual({ x: 600, y: 400, width: 50, height: 50 });
    expect(r.guides).toEqual([]);
  });

  it("the nearest target wins", () => {
    const o = { ...base, others: [A, { x: 108, y: 300, width: 30, height: 30 }] };
    expect(snapMove({ x: 105, y: 400, width: 50, height: 50 }, o).rect.x).toBe(108); // 3 px away beats 5 px away
  });

  it("the threshold decides", () => {
    const rect = { x: 104, y: 300, width: 50, height: 50 };
    expect(snapMove(rect, { ...base, threshold: 2 }).rect.x).toBe(104);
    expect(snapMove(rect, { ...base, threshold: 4 }).rect.x).toBe(100);
  });

  it("does nothing when object snapping and the grid are both off", () => {
    const r = snapMove({ x: 104, y: 97, width: 50, height: 50 }, { ...base, objects: false });
    expect(r.rect).toMatchObject({ x: 104, y: 97 });
    expect(r.guides).toEqual([]);
  });

  it("does not change the size", () => {
    const r = snapMove({ x: 104, y: 97, width: 51, height: 53 }, base);
    expect(r.rect.width).toBe(51);
    expect(r.rect.height).toBe(53);
  });
});

describe("snapMove to the grid", () => {
  const grid: SnapOptions = { ...base, objects: false, grid: 20 };

  it("snaps the top-left corner to the nearest gridline within the threshold", () => {
    expect(snapMove({ x: 36, y: 57, width: 50, height: 50 }, grid).rect).toMatchObject({ x: 40, y: 60 });
  });

  it("does not snap beyond the threshold", () => {
    expect(snapMove({ x: 33, y: 50, width: 50, height: 50 }, grid).rect).toMatchObject({ x: 33, y: 50 });
  });

  it("draws no guides for the grid", () => {
    expect(snapMove({ x: 36, y: 57, width: 50, height: 50 }, grid).guides).toEqual([]);
  });

  it("an object target that is closer than the grid line wins", () => {
    const o: SnapOptions = { ...base, others: [{ x: 37, y: 300, width: 50, height: 50 }], grid: 20 };
    expect(snapMove({ x: 36, y: 400, width: 50, height: 50 }, o).rect.x).toBe(37);
  });

  it("works together with object snapping when the grid is nearer", () => {
    const o: SnapOptions = { ...base, others: [{ x: 43, y: 300, width: 50, height: 50 }], grid: 20 };
    expect(snapMove({ x: 39, y: 400, width: 50, height: 50 }, o).rect.x).toBe(40); // grid line 1 px away, object 4 px away
  });
});

describe("alignmentGuides", () => {
  it("shows alignments that already exist, without moving anything", () => {
    const guides = alignmentGuides({ x: 100, y: 300, width: 100, height: 50 }, base);
    expect(guides).toContainEqual({ orientation: "vertical", position: 100, from: 100, to: 350 });
    expect(guides.find((g) => g.position === 150)).toBeUndefined();
  });

  it("merges guides at the same position", () => {
    const o: SnapOptions = { ...base, others: [A, { x: 100, y: 400, width: 50, height: 50 }] };
    const v = alignmentGuides({ x: 100, y: 300, width: 100, height: 50 }, o).filter((g) => g.orientation === "vertical" && g.position === 100);
    expect(v).toEqual([{ orientation: "vertical", position: 100, from: 100, to: 450 }]);
  });

  it("returns nothing when object snapping is off", () => {
    expect(alignmentGuides({ x: 100, y: 300, width: 100, height: 50 }, { ...base, objects: false })).toEqual([]);
  });
});

describe("snapResize", () => {
  it("snaps the moving right edge and leaves the left edge alone", () => {
    const r = snapResize({ x: 100, y: 400, width: 197, height: 50 }, "e", base);
    expect(r.rect).toEqual({ x: 100, y: 400, width: 200, height: 50 });
  });

  it("snaps the moving left edge, keeping the right edge fixed", () => {
    const r = snapResize({ x: 103, y: 400, width: 100, height: 50 }, "w", base);
    expect(r.rect).toEqual({ x: 100, y: 400, width: 103, height: 50 });
  });

  it("snaps the moving bottom and top edges", () => {
    expect(snapResize({ x: 600, y: 50, width: 100, height: 47 }, "s", base).rect).toEqual({ x: 600, y: 50, width: 100, height: 50 });
    expect(snapResize({ x: 600, y: 103, width: 100, height: 100 }, "n", base).rect).toEqual({ x: 600, y: 100, width: 100, height: 103 });
  });

  it("does not snap edges the handle is not moving", () => {
    const r = snapResize({ x: 100, y: 97, width: 197, height: 50 }, "e", base); // top 97 is near 100 but not being dragged
    expect(r.rect.y).toBe(97);
    expect(r.rect.width).toBe(200);
  });

  it("corner handles snap both moving edges", () => {
    const r = snapResize({ x: 600, y: 50, width: 297, height: 47 }, "se", { ...base, others: [{ x: 0, y: 100, width: 900, height: 10 }] });
    expect(r.rect.width).toBe(300); // right edge 897 -> 900
    expect(r.rect.height).toBe(50); // bottom 97 -> 100
  });

  it("ignores a snap that would shrink the box below the minimum size", () => {
    const o: SnapOptions = { ...base, others: [{ x: 104, y: 0, width: 100, height: 10 }] };
    const rect = { x: 100, y: 400, width: 21, height: 50 };
    expect(snapResize(rect, "w", o).rect).toEqual(rect); // snapping 4 px would leave 17 px
  });

  it("snaps a resized edge to the grid", () => {
    const o: SnapOptions = { ...base, objects: false, grid: 20 };
    expect(snapResize({ x: 100, y: 400, width: 143, height: 50 }, "e", o).rect.width).toBe(140);
  });
});

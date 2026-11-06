import { describe, expect, it } from "vitest";
import { createPresentation, createTextBox, duplicateSlide } from "../../src/core/document-model/factory";
import {
  boundsOf,
  expandSelection,
  groupObjects,
  isWholeGroup,
  minBoundsSize,
  normalizeGroups,
  scaleRect,
  ungroupObjects,
} from "../../src/core/document-model/groups";
import type { SlideObject } from "../../src/core/document-model/types";
import { MIN_OBJECT_SIZE, resizeRect } from "../../src/core/geometry/rect";

const obj = (id: string, extra: Partial<SlideObject> = {}): SlideObject => ({
  ...createTextBox(id, { x: 0, y: 0, width: 100, height: 50 }),
  id,
  ...extra,
});
const ids = (objects: SlideObject[]) => objects.map((o) => o.id);

describe("boundsOf", () => {
  it("is null for nothing and the enclosing rectangle otherwise", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ x: 10, y: 20, width: 30, height: 40 }])).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(boundsOf([{ x: 10, y: 20, width: 30, height: 40 }, { x: 0, y: 50, width: 20, height: 100 }])).toEqual({ x: 0, y: 20, width: 40, height: 130 });
  });
});

describe("expandSelection", () => {
  const list = [obj("a", { groupId: "g" }), obj("b"), obj("c", { groupId: "g" }), obj("d", { visible: false, groupId: "g" })];

  it("adds the other visible members of any group touched, in stacking order", () => {
    expect(expandSelection(list, ["a"])).toEqual(["a", "c"]);
    expect(expandSelection(list, ["c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("leaves ungrouped objects alone and never returns hidden objects", () => {
    expect(expandSelection(list, ["b"])).toEqual(["b"]);
    expect(expandSelection(list, ["d"])).toEqual(["a", "c"]);
    expect(expandSelection(list, [])).toEqual([]);
  });
});

describe("normalizeGroups", () => {
  it("dissolves groups with fewer than two members and keeps the rest", () => {
    const list = [obj("a", { groupId: "g" }), obj("b", { groupId: "g" }), obj("c", { groupId: "lonely" })];
    const out = normalizeGroups(list);
    expect(out.map((o) => o.groupId)).toEqual(["g", "g", null]);
  });

  it("returns the same array when nothing changes", () => {
    const list = [obj("a", { groupId: "g" }), obj("b", { groupId: "g" })];
    expect(normalizeGroups(list)).toBe(list);
  });
});

describe("groupObjects", () => {
  it("needs at least two objects", () => {
    expect(groupObjects([obj("a"), obj("b")], ["a"], "g")).toBeNull();
    expect(groupObjects([obj("a"), obj("b")], [], "g")).toBeNull();
  });

  it("makes the members contiguous at the position of the topmost one, keeping their relative order", () => {
    const list = [obj("a"), obj("b"), obj("c"), obj("d"), obj("e")];
    const out = groupObjects(list, ["a", "c", "d"], "g")!;
    expect(ids(out)).toEqual(["b", "a", "c", "d", "e"]);
    expect(out.filter((o) => o.groupId === "g").map((o) => o.id)).toEqual(["a", "c", "d"]);
    expect(out.find((o) => o.id === "b")!.groupId).toBeNull();
  });

  it("moves objects out of their old group and dissolves it if too few remain", () => {
    const list = [obj("a", { groupId: "old" }), obj("b", { groupId: "old" }), obj("c")];
    const out = groupObjects(list, ["a", "c"], "new")!;
    expect(out.find((o) => o.id === "a")!.groupId).toBe("new");
    expect(out.find((o) => o.id === "c")!.groupId).toBe("new");
    expect(out.find((o) => o.id === "b")!.groupId).toBeNull(); // left alone in "old": dissolved
  });

  it("does not modify its input", () => {
    const list = [obj("a"), obj("b")];
    groupObjects(list, ["a", "b"], "g");
    expect(list.every((o) => o.groupId === null)).toBe(true);
  });
});

describe("ungroupObjects", () => {
  it("ungroups every member of each group touched", () => {
    const list = [obj("a", { groupId: "g" }), obj("b", { groupId: "g" }), obj("c", { groupId: "h" }), obj("d", { groupId: "h" })];
    const out = ungroupObjects(list, ["a"]);
    expect(out.map((o) => o.groupId)).toEqual([null, null, "h", "h"]);
  });

  it("returns the same array when nothing is grouped", () => {
    const list = [obj("a"), obj("b")];
    expect(ungroupObjects(list, ["a", "b"])).toBe(list);
  });
});

describe("isWholeGroup", () => {
  const list = [obj("a", { groupId: "g" }), obj("b", { groupId: "g" }), obj("c")];
  it("is true only for exactly all members of one group", () => {
    expect(isWholeGroup(list, ["a", "b"])).toBe(true);
    expect(isWholeGroup(list, ["a"])).toBe(false);
    expect(isWholeGroup(list, ["a", "b", "c"])).toBe(false);
    expect(isWholeGroup(list, ["c"])).toBe(false);
    expect(isWholeGroup(list, [])).toBe(false);
  });
});

describe("scaleRect and minBoundsSize", () => {
  const from = { x: 100, y: 100, width: 200, height: 100 };

  it("keeps a rectangle's relative place and size inside the scaled bounds", () => {
    const to = { x: 50, y: 0, width: 400, height: 50 };
    expect(scaleRect({ x: 150, y: 110, width: 100, height: 50 }, from, to)).toEqual({ x: 150, y: 5, width: 200, height: 25 });
    expect(scaleRect(from, from, from)).toEqual(from);
  });

  it("is a pure translation when the size is unchanged", () => {
    expect(scaleRect({ x: 150, y: 120, width: 30, height: 20 }, from, { ...from, x: 160, y: 90 })).toEqual({ x: 210, y: 110, width: 30, height: 20 });
  });

  it("copes with zero-sized bounds", () => {
    expect(scaleRect({ x: 5, y: 5, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 10, height: 10 })).toMatchObject({ width: 1, height: 1 });
  });

  it("minBoundsSize is the smallest bounds at which every member keeps the minimum size", () => {
    const rects = [{ x: 0, y: 0, width: 400, height: 40 }, { x: 0, y: 60, width: 40, height: 200 }];
    const bounds = boundsOf(rects)!; // 400 x 260
    const min = minBoundsSize(rects, bounds);
    expect(min.width).toBeCloseTo((MIN_OBJECT_SIZE / 40) * 400, 9); // the 40 px wide member limits the width: 200
    expect(min.height).toBeCloseTo((MIN_OBJECT_SIZE / 40) * 260, 9); // the 40 px tall member limits the height: 130
  });
});

describe("resizeRect with per-axis minimums", () => {
  it("honours minWidth and minHeight separately", () => {
    const r = { x: 0, y: 0, width: 400, height: 260 };
    const out = resizeRect(r, "se", -5000, -5000, { minWidth: 200, minHeight: 130 });
    expect(out).toMatchObject({ width: 200, height: 130 });
  });

  it("keeps the proportions when locked, without going below either minimum", () => {
    const r = { x: 0, y: 0, width: 400, height: 260 };
    const out = resizeRect(r, "se", -5000, -5000, { keepAspect: true, minWidth: 200, minHeight: 130 });
    expect(out.width / out.height).toBeCloseTo(400 / 260, 6);
    expect(out.width).toBeGreaterThanOrEqual(200 - 1e-6);
    expect(out.height).toBeGreaterThanOrEqual(130 - 1e-6);
  });
});

describe("duplicateSlide", () => {
  it("gives the copy its own group ids, keeping its objects grouped together", () => {
    const slide = createPresentation("T").slides[0];
    slide.objects[0].groupId = "g";
    slide.objects[1].groupId = "g";
    const copy = duplicateSlide(slide);
    const [a, b] = copy.objects;
    expect(a.groupId).not.toBeNull();
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupId).not.toBe("g");
    expect(slide.objects[0].groupId).toBe("g");
  });

  it("keeps ungrouped objects ungrouped and copies locks", () => {
    const slide = createPresentation("T").slides[0];
    slide.objects[0].locked = true;
    const copy = duplicateSlide(slide);
    expect(copy.objects.map((o) => o.groupId)).toEqual([null, null]);
    expect(copy.objects[0].locked).toBe(true);
  });
});

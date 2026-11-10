import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { SHAPE_INFO } from "../../src/core/document-model/shapes";
import type { ShapeKind } from "../../src/core/document-model/types";
import { parsePresentation } from "../../src/core/serialization/migrate";
import { editorReducer, initEditorState, type EditorAction, type EditorState } from "../../src/state/editorReducer";
import { describeAction, historyReducer, initHistoryState } from "../../src/state/history";

const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const objects = (s: EditorState) => s.presentation.slides.find((x) => x.id === s.currentSlideId)!.objects;
const byName = (s: EditorState, name: string) => objects(s).find((o) => o.name === name)!;
const fresh = () => initEditorState(createPresentation("T"));
const add = (s: EditorState, shape: ShapeKind) => run(s, { type: "addShape", shape });

describe("addShape", () => {
  it("inserts each shape centered on the slide, selected, with its own name and default size", () => {
    const cases: [ShapeKind, string, number, number, number, number][] = [
      ["rectangle", "Rectangle 1", 360, 200, 240, 140],
      ["roundRect", "Rounded rectangle 1", 360, 200, 240, 140],
      ["ellipse", "Oval 1", 380, 200, 200, 140],
      ["line", "Line 1", 360, 270, 240, 0],
    ];
    for (const [kind, name, x, y, width, height] of cases) {
      const s = add(fresh(), kind);
      const o = byName(s, name);
      expect(o, kind).toMatchObject({ role: "shape", shape: kind, x, y, width, height });
      expect(s.selectedObjectIds).toEqual([o.id]);
      expect(s.selectedObjectId).toBe(o.id);
      expect(s.editingObjectId).toBeNull();
      expect(parsePresentation(s.presentation).ok, kind).toBe(true);
    }
  });

  it("numbers shapes of a kind and cascades them so they do not stack exactly", () => {
    const s = add(add(add(fresh(), "rectangle"), "rectangle"), "ellipse");
    expect(byName(s, "Rectangle 2")).toMatchObject({ x: 384, y: 224 });
    expect(byName(s, "Oval 1")).toMatchObject({ x: 380, y: 200 });
    expect(new Set(objects(s).map((o) => o.id)).size).toBe(objects(s).length);
  });

  it("ignores an unknown kind", () => {
    const s = fresh();
    expect(editorReducer(s, { type: "addShape", shape: "star" as ShapeKind })).toBe(s);
  });

  it("is named and recorded in the undo history", () => {
    expect(describeAction({ type: "addShape", shape: "line" })).toBe("Insert shape");
    const h = historyReducer(initHistoryState(createPresentation("T")), { type: "addShape", shape: "ellipse" });
    expect(h.past).toHaveLength(1);
    expect(h.past[0].label).toBe("Insert shape");
    expect(historyReducer(h, { type: "undo" }).present.presentation.slides[0].objects.some((o) => o.role === "shape")).toBe(false);
  });
});

describe("sizes", () => {
  it("a rectangle can not be smaller than 20 x 20, but a line may be flat", () => {
    const s = add(add(fresh(), "rectangle"), "line");
    const rect = byName(s, "Rectangle 1");
    const line = byName(s, "Line 1");
    const tiny = run(s, { type: "setObjectRect", objectId: rect.id, rect: { x: 10, y: 10, width: 3, height: 0 } });
    expect(byName(tiny, "Rectangle 1")).toMatchObject({ width: 20, height: 20 });
    const flat = run(s, { type: "setObjectRect", objectId: line.id, rect: { x: 100, y: 100, width: 240, height: 0 } });
    expect(byName(flat, "Line 1")).toMatchObject({ x: 100, y: 100, width: 240, height: 0 });
    const vertical = run(s, { type: "setObjectRect", objectId: line.id, rect: { x: 5, y: 100, width: 0, height: 150 } });
    expect(byName(vertical, "Line 1")).toMatchObject({ x: 5, width: 0, height: 150 });
  });

  it("a line can never be shrunk below 10 px of length", () => {
    const s = add(fresh(), "line");
    const line = byName(s, "Line 1");
    expect(editorReducer(s, { type: "setObjectRect", objectId: line.id, rect: { x: 100, y: 100, width: 3, height: 4 } })).toBe(s);
    expect(editorReducer(s, { type: "setObjectRect", objectId: line.id, rect: { x: 100, y: 100, width: 0, height: 0 } })).toBe(s);
    const ok = run(s, { type: "setObjectRect", objectId: line.id, rect: { x: 100, y: 100, width: 10, height: 0 } });
    expect(byName(ok, "Line 1").width).toBe(10);
  });

  it("setObjectRects follows the same rules per object", () => {
    const s = add(add(fresh(), "rectangle"), "line");
    const [rect, line] = [byName(s, "Rectangle 1"), byName(s, "Line 1")];
    const okMove = run(s, { type: "setObjectRects", rects: { [rect.id]: { x: 10, y: 10, width: 240, height: 140 }, [line.id]: { x: 10, y: 300, width: 240, height: 0 } } });
    expect(byName(okMove, "Line 1")).toMatchObject({ y: 300, height: 0 });
    expect(editorReducer(s, { type: "setObjectRects", rects: { [rect.id]: { x: 10, y: 10, width: 240, height: 0 } } })).toBe(s); // a rectangle cannot be flat
    expect(editorReducer(s, { type: "setObjectRects", rects: { [line.id]: { x: 10, y: 10, width: 2, height: 2 } } })).toBe(s); // nor a line made to vanish
  });
});

describe("text in shapes", () => {
  it("closed shapes can be edited in place and hold text; lines cannot", () => {
    const s = add(add(fresh(), "rectangle"), "line");
    const rect = byName(s, "Rectangle 1");
    const line = byName(s, "Line 1");
    expect(editorReducer(s, { type: "startEditing", objectId: line.id })).toBe(s);
    const editing = run(s, { type: "startEditing", objectId: rect.id });
    expect(editing.editingObjectId).toBe(rect.id);
    const typed = run(editing, { type: "setObjectText", slideId: s.currentSlideId, objectId: rect.id, text: "Hello" });
    expect(byName(typed, "Rectangle 1").text).toBe("Hello");
  });

  it("shapes can be grouped and locked like any object", () => {
    let s = add(add(fresh(), "rectangle"), "ellipse");
    s = run(s, { type: "selectAllObjects" }, { type: "groupSelection" }, { type: "setObjectsLocked", locked: true });
    expect(objects(s).every((o) => o.groupId !== null && o.locked)).toBe(true);
    const rect = byName(s, "Rectangle 1");
    expect(editorReducer(s, { type: "setObjectRect", objectId: rect.id, rect: { x: 1, y: 1, width: 50, height: 50 } })).toBe(s);
  });

  it("the default size table matches what is inserted", () => {
    for (const kind of ["rectangle", "roundRect", "ellipse", "line"] as const) {
      const s = add(fresh(), kind);
      const o = objects(s).find((x) => x.shape === kind && x.role === "shape")!;
      expect([o.width, o.height]).toEqual([SHAPE_INFO[kind].width, SHAPE_INFO[kind].height]);
    }
  });
});

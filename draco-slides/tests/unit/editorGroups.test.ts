import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { parsePresentation } from "../../src/core/serialization/migrate";
import { editorReducer, initEditorState, type EditorAction, type EditorState } from "../../src/state/editorReducer";

const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const objects = (s: EditorState) => s.presentation.slides.find((x) => x.id === s.currentSlideId)!.objects;
const byName = (s: EditorState, name: string) => objects(s).find((o) => o.name === name)!;
/** Title, Body, Text box 1, Text box 2 (in that stacking order), nothing selected. */
const base = () => {
  let s = initEditorState(createPresentation("T"));
  s = run(s, { type: "addTextBox" }, { type: "addTextBox" }, { type: "selectObjects", objectIds: [] });
  return s;
};
const id = (s: EditorState, name: string) => byName(s, name).id;
const select = (s: EditorState, ...names: string[]) => run(s, { type: "selectObjects", objectIds: names.map((n) => id(s, n)) });

describe("selection", () => {
  it("selects several objects in stacking order; selectedObjectId is only set for exactly one", () => {
    const s = select(base(), "Text box 1", "Title");
    expect(s.selectedObjectIds).toEqual([id(s, "Title"), id(s, "Text box 1")]);
    expect(s.selectedObjectId).toBeNull();
    const one = select(s, "Body");
    expect(one.selectedObjectId).toBe(id(one, "Body"));
    expect(run(one, { type: "selectObjects", objectIds: [] }).selectedObjectId).toBeNull();
  });

  it("ignores unknown or hidden objects, and returns the same state for an unchanged selection", () => {
    const s = select(base(), "Title");
    expect(editorReducer(s, { type: "selectObjects", objectIds: ["nope"] })).toBe(s);
    expect(editorReducer(s, { type: "selectObjects", objectIds: [id(s, "Title")] })).toBe(s);
    const hidden = base();
    hidden.presentation.slides[0].objects[0].visible = false;
    expect(editorReducer(hidden, { type: "selectObjects", objectIds: [hidden.presentation.slides[0].objects[0].id] })).toBe(hidden);
  });

  it("toggling adds and removes objects", () => {
    let s = select(base(), "Title");
    s = run(s, { type: "toggleObjectSelection", objectId: id(s, "Body") });
    expect(s.selectedObjectIds).toEqual([id(s, "Title"), id(s, "Body")]);
    s = run(s, { type: "toggleObjectSelection", objectId: id(s, "Title") });
    expect(s.selectedObjectIds).toEqual([id(s, "Body")]);
    expect(s.selectedObjectId).toBe(id(s, "Body"));
  });

  it("select all selects every visible object", () => {
    const s = run(base(), { type: "selectAllObjects" });
    expect(s.selectedObjectIds).toHaveLength(4);
    expect(s.selectedObjectId).toBeNull();
  });

  it("changing slide, adding a slide or a text box resets the selection", () => {
    const s = select(base(), "Title", "Body");
    expect(run(s, { type: "addSlide" }).selectedObjectIds).toEqual([]);
    expect(run(s, { type: "addTextBox" }).selectedObjectIds).toHaveLength(1);
    expect(run(s, { type: "duplicateSlide", slideId: s.currentSlideId }).selectedObjectIds).toEqual([]);
  });

  it("selecting several objects ends text editing; selecting just the edited one keeps it", () => {
    let s = select(base(), "Text box 1");
    s = run(s, { type: "startEditing", objectId: id(s, "Text box 1") });
    expect(run(s, { type: "selectObjects", objectIds: [id(s, "Text box 1"), id(s, "Title")] }).editingObjectId).toBeNull();
    expect(run(s, { type: "selectObjects", objectIds: [id(s, "Text box 1")] })).toBe(s);
  });
});

describe("groups", () => {
  const grouped = () => run(select(base(), "Title", "Body"), { type: "groupSelection" });

  it("groupSelection groups the selection and keeps it selected", () => {
    const s = grouped();
    const [t, b] = [byName(s, "Title"), byName(s, "Body")];
    expect(t.groupId).not.toBeNull();
    expect(t.groupId).toBe(b.groupId);
    expect(s.selectedObjectIds).toEqual([t.id, b.id]);
    expect(byName(s, "Text box 1").groupId).toBeNull();
    expect(parsePresentation(s.presentation).ok).toBe(true);
  });

  it("needs at least two selected objects", () => {
    const one = select(base(), "Title");
    expect(editorReducer(one, { type: "groupSelection" })).toBe(one);
    const none = base();
    expect(editorReducer(none, { type: "groupSelection" })).toBe(none);
  });

  it("selecting one member selects the whole group, unless told not to expand", () => {
    const s = run(grouped(), { type: "selectObjects", objectIds: [] });
    const one = run(s, { type: "selectObject", objectId: id(s, "Title") });
    expect(one.selectedObjectIds).toEqual([id(s, "Title"), id(s, "Body")]);
    const drilled = run(s, { type: "selectObjects", objectIds: [id(s, "Title")], expand: false });
    expect(drilled.selectedObjectIds).toEqual([id(s, "Title")]);
    expect(drilled.selectedObjectId).toBe(id(s, "Title"));
  });

  it("startEditing on a group member selects only that member", () => {
    const s = grouped();
    const e = run(s, { type: "startEditing", objectId: id(s, "Title") });
    expect(e.selectedObjectIds).toEqual([id(s, "Title")]);
    expect(e.editingObjectId).toBe(id(s, "Title"));
  });

  it("toggling a member toggles the whole group", () => {
    let s = run(grouped(), { type: "selectObjects", objectIds: [] });
    s = run(s, { type: "toggleObjectSelection", objectId: id(s, "Title") });
    expect(s.selectedObjectIds).toHaveLength(2);
    s = run(s, { type: "toggleObjectSelection", objectId: id(s, "Body") });
    expect(s.selectedObjectIds).toEqual([]);
  });

  it("ungroupSelection ungroups, keeps the selection, and is a no-op without groups", () => {
    const s = run(grouped(), { type: "ungroupSelection" });
    expect(objects(s).every((o) => o.groupId === null)).toBe(true);
    expect(s.selectedObjectIds).toHaveLength(2);
    expect(editorReducer(s, { type: "ungroupSelection" })).toBe(s);
  });

  it("grouping a selection that includes a group member regroups without leaving a one-member group", () => {
    const s = grouped();
    const drilled = run(s, { type: "selectObjects", objectIds: [id(s, "Title")], expand: false }, { type: "toggleObjectSelection", objectId: id(s, "Text box 1") });
    const regrouped = run(drilled, { type: "groupSelection" });
    expect(byName(regrouped, "Title").groupId).toBe(byName(regrouped, "Text box 1").groupId);
    expect(byName(regrouped, "Body").groupId).toBeNull(); // the old group had only Body left
  });

  it("deleting one member of a two-member group dissolves the group", () => {
    const s = grouped();
    const d = run(s, { type: "selectObjects", objectIds: [id(s, "Title")], expand: false }, { type: "deleteSelection" });
    expect(byName(d, "Body").groupId).toBeNull();
    expect(objects(d)).toHaveLength(3);
  });

  it("deleting one member of a larger group keeps the rest grouped", () => {
    let s = run(select(base(), "Title", "Body", "Text box 1"), { type: "groupSelection" });
    s = run(s, { type: "deleteObject", objectId: id(s, "Title") });
    expect(byName(s, "Body").groupId).not.toBeNull();
    expect(byName(s, "Body").groupId).toBe(byName(s, "Text box 1").groupId);
  });
});

describe("locking", () => {
  const locked = (...names: string[]) => run(select(base(), ...names), { type: "setObjectsLocked", locked: true });

  it("locks and unlocks the selected objects only", () => {
    const s = locked("Title", "Body");
    expect(byName(s, "Title").locked).toBe(true);
    expect(byName(s, "Body").locked).toBe(true);
    expect(byName(s, "Text box 1").locked).toBe(false);
    const u = run(s, { type: "setObjectsLocked", locked: false });
    expect(objects(u).every((o) => !o.locked)).toBe(true);
    expect(editorReducer(u, { type: "setObjectsLocked", locked: false })).toBe(u);
    expect(editorReducer(s, { type: "setObjectsLocked", locked: true })).toBe(s);
  });

  it("a locked object cannot be moved, resized or deleted", () => {
    const s = locked("Text box 1");
    const t = byName(s, "Text box 1");
    expect(editorReducer(s, { type: "setObjectRect", objectId: t.id, rect: { x: 1, y: 1, width: 50, height: 50 } })).toBe(s);
    expect(editorReducer(s, { type: "setObjectRects", rects: { [t.id]: { x: 1, y: 1, width: 50, height: 50 } } })).toBe(s);
    expect(editorReducer(s, { type: "deleteObject", objectId: t.id })).toBe(s);
    expect(editorReducer(s, { type: "deleteSelection" })).toBe(s);
  });

  it("deleting a selection that contains a locked object deletes nothing", () => {
    const s = locked("Text box 1");
    const mixed = run(s, { type: "selectObjects", objectIds: [id(s, "Text box 1"), id(s, "Title")] });
    expect(editorReducer(mixed, { type: "deleteSelection" })).toBe(mixed);
  });

  it("text and formatting can still be changed on a locked object", () => {
    const s = locked("Text box 1");
    const t = byName(s, "Text box 1");
    const text = run(s, { type: "setObjectText", slideId: s.currentSlideId, objectId: t.id, text: "new" });
    expect(byName(text, "Text box 1").text).toBe("new");
    expect(byName(run(s, { type: "setTextFormat", objectId: t.id, patch: { bold: true } }), "Text box 1").bold).toBe(true);
    expect(byName(run(s, { type: "setParagraphFormat", objectId: t.id, patch: { align: "center" } }), "Text box 1").align).toBe("center");
    expect(byName(run(s, { type: "setBoxFormat", objectId: t.id, patch: { verticalAlign: "middle" } }), "Text box 1").verticalAlign).toBe("middle");
  });

  it("lock state survives a document round trip validation", () => {
    expect(parsePresentation(locked("Title").presentation).ok).toBe(true);
  });
});

describe("setObjectRects", () => {
  const two = () => select(base(), "Title", "Body");
  const rect = (x: number, y: number, width = 100, height = 50) => ({ x, y, width, height });

  it("moves several objects at once and rounds to two decimals", () => {
    const s = two();
    const r = run(s, { type: "setObjectRects", rects: { [id(s, "Title")]: rect(10.123, 20), [id(s, "Body")]: rect(30, 40.456) } });
    expect(byName(r, "Title")).toMatchObject({ x: 10.12, y: 20, width: 100, height: 50 });
    expect(byName(r, "Body")).toMatchObject({ x: 30, y: 40.46 });
    expect(parsePresentation(r.presentation).ok).toBe(true);
  });

  it("does not clamp members individually, so a group keeps its shape off the slide", () => {
    const s = two();
    const r = run(s, { type: "setObjectRects", rects: { [id(s, "Title")]: rect(-500, 20), [id(s, "Body")]: rect(2000, 40) } });
    expect(byName(r, "Title").x).toBe(-500);
    expect(byName(r, "Body").x).toBe(2000);
  });

  it("rejects the whole change for unknown ids, locked, non-finite, tiny, huge or far-away rectangles", () => {
    const s = two();
    const t = id(s, "Title");
    const bad = (r: Record<string, ReturnType<typeof rect>>) => expect(editorReducer(s, { type: "setObjectRects", rects: r })).toBe(s);
    bad({ nope: rect(1, 1) });
    bad({ [t]: rect(Number.NaN, 1) });
    bad({ [t]: rect(1, 1, 5, 50) });
    bad({ [t]: rect(1, 1, 100, 5) });
    bad({ [t]: rect(1, 1, 99999, 50) });
    bad({ [t]: rect(1e6, 1) });
    expect(editorReducer(s, { type: "setObjectRects", rects: {} })).toBe(s);
  });

  it("returns the same state when nothing changes", () => {
    const s = two();
    const t = byName(s, "Title");
    expect(editorReducer(s, { type: "setObjectRects", rects: { [t.id]: { x: t.x, y: t.y, width: t.width, height: t.height } } })).toBe(s);
  });
});

describe("deleteSelection", () => {
  it("removes every selected object and clears the selection", () => {
    const s = run(select(base(), "Title", "Text box 2"), { type: "deleteSelection" });
    expect(objects(s).map((o) => o.name)).toEqual(["Body", "Text box 1"]);
    expect(s.selectedObjectIds).toEqual([]);
    expect(s.editingObjectId).toBeNull();
  });

  it("does nothing with an empty selection", () => {
    const s = base();
    expect(editorReducer(s, { type: "deleteSelection" })).toBe(s);
  });
});

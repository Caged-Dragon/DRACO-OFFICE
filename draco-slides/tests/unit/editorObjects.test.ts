import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { parsePresentation } from "../../src/core/serialization/migrate";
import { editorReducer, initEditorState, type EditorState } from "../../src/state/editorReducer";

const fresh = (size?: "16:9" | "4:3") => initEditorState(createPresentation("T", { size }));
const addBox = (s: EditorState) => editorReducer(s, { type: "addTextBox" });
const objects = (s: EditorState) => s.presentation.slides.find((x) => x.id === s.currentSlideId)!.objects;
const boxes = (s: EditorState) => objects(s).filter((o) => o.role === "textbox");

describe("addTextBox", () => {
  it("adds a centered, selected, valid text box", () => {
    const s = addBox(fresh());
    const [box] = boxes(s);
    expect(box).toMatchObject({ name: "Text box 1", x: 330, y: 230, width: 300, height: 80, text: "Text box", visible: true, rotation: 0 });
    expect(s.selectedObjectId).toBe(box.id);
    expect(s.presentation.schemaVersion).toBe(3);
    expect(parsePresentation(s.presentation).ok).toBe(true);
  });

  it("centers on the actual slide size", () => {
    expect(boxes(addBox(fresh("4:3")))[0]).toMatchObject({ x: 330, y: 320 });
  });

  it("names boxes uniquely and cascades them so they do not stack exactly", () => {
    const s = addBox(addBox(addBox(fresh())));
    expect(boxes(s).map((b) => b.name)).toEqual(["Text box 1", "Text box 2", "Text box 3"]);
    expect(boxes(s).map((b) => [b.x, b.y])).toEqual([[330, 230], [354, 254], [378, 278]]);
    expect(new Set(objects(s).map((o) => o.id)).size).toBe(objects(s).length);
  });

  it("reuses the lowest free name after a delete", () => {
    let s = addBox(addBox(fresh()));
    s = editorReducer(s, { type: "deleteObject", objectId: boxes(s)[0].id });
    s = addBox(s);
    expect(boxes(s).map((b) => b.name).sort()).toEqual(["Text box 1", "Text box 2"]);
  });
});

describe("selection", () => {
  it("selects a known object, ignores unknown ones, and clears with null", () => {
    const s0 = fresh();
    const id = objects(s0)[0].id;
    const s1 = editorReducer(s0, { type: "selectObject", objectId: id });
    expect(s1.selectedObjectId).toBe(id);
    expect(editorReducer(s1, { type: "selectObject", objectId: id })).toBe(s1);
    expect(editorReducer(s1, { type: "selectObject", objectId: "nope" })).toBe(s1);
    expect(editorReducer(s1, { type: "selectObject", objectId: null }).selectedObjectId).toBeNull();
  });

  it("is cleared when another slide becomes current, kept when the same slide is re-selected or moved", () => {
    let s = addBox(fresh());
    const first = s.currentSlideId;
    s = editorReducer(s, { type: "selectSlide", slideId: first });
    expect(s.selectedObjectId).not.toBeNull();
    s = editorReducer(s, { type: "moveSlide", slideId: first, toIndex: 0 });
    expect(s.selectedObjectId).not.toBeNull();
    s = editorReducer(s, { type: "addSlide" });
    expect(s.selectedObjectId).toBeNull();
    s = editorReducer(s, { type: "selectSlide", slideId: first });
    expect(s.selectedObjectId).toBeNull();
  });

  it("is cleared by duplicate and by deleting the current slide", () => {
    let s = addBox(fresh());
    s = editorReducer(s, { type: "duplicateSlide", slideId: s.currentSlideId });
    expect(s.selectedObjectId).toBeNull();
    s = addBox(s);
    s = editorReducer(s, { type: "deleteSlide", slideId: s.currentSlideId });
    expect(s.selectedObjectId).toBeNull();
  });
});

describe("setObjectRect", () => {
  const withBox = () => {
    const s = addBox(fresh());
    return { s, id: boxes(s)[0].id };
  };

  it("moves and resizes, constraining the result", () => {
    const { s, id } = withBox();
    const moved = editorReducer(s, { type: "setObjectRect", objectId: id, rect: { x: 380, y: 260, width: 300, height: 80 } });
    expect(boxes(moved)[0]).toMatchObject({ x: 380, y: 260 });
    const tiny = editorReducer(s, { type: "setObjectRect", objectId: id, rect: { x: 0, y: 0, width: 1, height: 1 } });
    expect(boxes(tiny)[0]).toMatchObject({ width: 20, height: 20 });
    const off = editorReducer(s, { type: "setObjectRect", objectId: id, rect: { x: 99999, y: -99999, width: 300, height: 80 } });
    expect(boxes(off)[0]).toMatchObject({ x: 940, y: -60 });
    expect(parsePresentation(off.presentation).ok).toBe(true);
  });

  it("returns the same state for no-ops, non-finite values and unknown objects", () => {
    const { s, id } = withBox();
    const b = boxes(s)[0];
    expect(editorReducer(s, { type: "setObjectRect", objectId: id, rect: { x: b.x, y: b.y, width: b.width, height: b.height } })).toBe(s);
    expect(editorReducer(s, { type: "setObjectRect", objectId: id, rect: { x: Number.NaN, y: 0, width: 10, height: 10 } })).toBe(s);
    expect(editorReducer(s, { type: "setObjectRect", objectId: "nope", rect: { x: 1, y: 1, width: 50, height: 50 } })).toBe(s);
  });

  it("does not touch other objects", () => {
    const { s, id } = withBox();
    const before = objects(s).filter((o) => o.id !== id);
    const after = objects(editorReducer(s, { type: "setObjectRect", objectId: id, rect: { x: 1, y: 1, width: 50, height: 50 } })).filter((o) => o.id !== id);
    expect(after).toEqual(before);
  });
});

describe("deleteObject", () => {
  it("removes the object and clears the selection only if it was selected", () => {
    let s = addBox(addBox(fresh()));
    const [a, b] = boxes(s);
    s = editorReducer(s, { type: "selectObject", objectId: b.id });
    const afterA = editorReducer(s, { type: "deleteObject", objectId: a.id });
    expect(boxes(afterA)).toHaveLength(1);
    expect(afterA.selectedObjectId).toBe(b.id);
    const afterB = editorReducer(s, { type: "deleteObject", objectId: b.id });
    expect(afterB.selectedObjectId).toBeNull();
  });

  it("can delete placeholders too, and ignores unknown ids", () => {
    const s = fresh();
    const title = objects(s)[0];
    expect(objects(editorReducer(s, { type: "deleteObject", objectId: title.id }))).toHaveLength(objects(s).length - 1);
    expect(editorReducer(s, { type: "deleteObject", objectId: "nope" })).toBe(s);
  });
});

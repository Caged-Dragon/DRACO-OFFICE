import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { editorReducer, initEditorState, type EditorState } from "../../src/state/editorReducer";

const withBox = () => {
  const s = editorReducer(initEditorState(createPresentation("T")), { type: "addTextBox" });
  const id = s.selectedObjectId!;
  return { s, id };
};
const cur = (s: EditorState) => s.presentation.slides.find((x) => x.id === s.currentSlideId)!;

describe("editing state", () => {
  it("startEditing selects the object and marks it as being edited", () => {
    const { s, id } = withBox();
    const e = editorReducer(s, { type: "startEditing", objectId: id });
    expect(e.editingObjectId).toBe(id);
    expect(e.selectedObjectId).toBe(id);
    expect(editorReducer(e, { type: "startEditing", objectId: id })).toBe(e);
  });

  it("can edit a placeholder that was not selected, and selects it", () => {
    const s0 = initEditorState(createPresentation("T"));
    const title = cur(s0).objects[0];
    const e = editorReducer(s0, { type: "startEditing", objectId: title.id });
    expect(e.editingObjectId).toBe(title.id);
    expect(e.selectedObjectId).toBe(title.id);
  });

  it("ignores unknown and hidden objects", () => {
    const { s } = withBox();
    expect(editorReducer(s, { type: "startEditing", objectId: "nope" })).toBe(s);
    const hiddenDoc = createPresentation("H");
    hiddenDoc.slides[0].objects[0].visible = false;
    const h = initEditorState(hiddenDoc);
    expect(editorReducer(h, { type: "startEditing", objectId: hiddenDoc.slides[0].objects[0].id })).toBe(h);
  });

  it("stopEditing clears it and is a no-op when not editing", () => {
    const { s, id } = withBox();
    expect(editorReducer(s, { type: "stopEditing" })).toBe(s);
    const e = editorReducer(s, { type: "startEditing", objectId: id });
    const stopped = editorReducer(e, { type: "stopEditing" });
    expect(stopped.editingObjectId).toBeNull();
    expect(stopped.selectedObjectId).toBe(id);
  });

  it("selecting a different object or nothing ends editing; re-selecting the same one does not", () => {
    let { s, id } = withBox();
    s = editorReducer(s, { type: "addTextBox" });
    const second = s.selectedObjectId!;
    s = editorReducer(s, { type: "startEditing", objectId: id });
    expect(editorReducer(s, { type: "selectObject", objectId: id })).toBe(s);
    expect(editorReducer(s, { type: "selectObject", objectId: second }).editingObjectId).toBeNull();
    expect(editorReducer(s, { type: "selectObject", objectId: null }).editingObjectId).toBeNull();
  });

  it("changing slide, deleting the object or the slide, or adding or duplicating a slide ends editing", () => {
    const { s, id } = withBox();
    const first = s.currentSlideId;
    const e = editorReducer(s, { type: "startEditing", objectId: id });
    expect(editorReducer(e, { type: "deleteObject", objectId: id }).editingObjectId).toBeNull();
    expect(editorReducer(e, { type: "addSlide" }).editingObjectId).toBeNull();
    expect(editorReducer(e, { type: "duplicateSlide", slideId: first }).editingObjectId).toBeNull();
    const two = editorReducer(editorReducer(e, { type: "addSlide" }), { type: "selectSlide", slideId: first });
    expect(two.editingObjectId).toBeNull();
    expect(editorReducer(two, { type: "deleteSlide", slideId: first }).editingObjectId).toBeNull();
  });

  it("reordering slides keeps editing", () => {
    const { s, id } = withBox();
    const e = editorReducer(s, { type: "startEditing", objectId: id });
    expect(editorReducer(e, { type: "moveSlide", slideId: e.currentSlideId, toIndex: 0 })).toBe(e);
  });

  it("setObjectText stores multi-line text", () => {
    const { s, id } = withBox();
    const e = editorReducer(s, { type: "setObjectText", slideId: s.currentSlideId, objectId: id, text: "a\n\nb" });
    expect(cur(e).objects.find((o) => o.id === id)!.text).toBe("a\n\nb");
  });
});

import { describe, expect, it } from "vitest";
import { createPresentation, isPresentation } from "../../src/core/document-model/factory";
import { editorReducer, initEditorState } from "../../src/state/editorReducer";

describe("editorReducer", () => {
  it("adds a slide after the current one and selects it", () => {
    const s0 = initEditorState(createPresentation());
    const s1 = editorReducer(s0, { type: "addSlide" });
    expect(s1.presentation.slides).toHaveLength(2);
    expect(s1.currentSlideId).toBe(s1.presentation.slides[1].id);
  });

  it("never deletes the last slide", () => {
    const s0 = initEditorState(createPresentation());
    const s1 = editorReducer(s0, { type: "deleteSlide", slideId: s0.currentSlideId });
    expect(s1.presentation.slides).toHaveLength(1);
  });

  it("moves selection when the current slide is deleted", () => {
    let s = initEditorState(createPresentation());
    s = editorReducer(s, { type: "addSlide" });
    const removed = s.currentSlideId;
    s = editorReducer(s, { type: "deleteSlide", slideId: removed });
    expect(s.presentation.slides).toHaveLength(1);
    expect(s.currentSlideId).toBe(s.presentation.slides[0].id);
  });

  it("ignores selecting an unknown slide", () => {
    const s0 = initEditorState(createPresentation());
    expect(editorReducer(s0, { type: "selectSlide", slideId: "nope" })).toBe(s0);
  });

  it("falls back to a default title when renamed to blank", () => {
    const s = editorReducer(initEditorState(createPresentation()), { type: "renamePresentation", title: "   " });
    expect(s.presentation.title).toBe("Untitled presentation");
  });

  it("edits object text immutably", () => {
    const s0 = initEditorState(createPresentation());
    const slide = s0.presentation.slides[0];
    const s1 = editorReducer(s0, { type: "setObjectText", slideId: slide.id, objectId: slide.objects[0].id, text: "Hi" });
    expect(s1.presentation.slides[0].objects[0].text).toBe("Hi");
    expect(s0.presentation.slides[0].objects[0].text).not.toBe("Hi");
  });
});

describe("isPresentation", () => {
  it("accepts a new presentation and rejects junk", () => {
    expect(isPresentation(createPresentation())).toBe(true);
    expect(isPresentation({})).toBe(false);
    expect(isPresentation(null)).toBe(false);
  });
});

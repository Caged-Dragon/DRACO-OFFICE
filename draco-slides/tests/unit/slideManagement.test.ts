import { describe, expect, it } from "vitest";
import { createPresentation, duplicateSlide, nextSlideName } from "../../src/core/document-model/factory";
import { parsePresentation } from "../../src/core/serialization/migrate";
import { editorReducer, initEditorState, type EditorState } from "../../src/state/editorReducer";

const withSlides = (n: number): EditorState => {
  let s = initEditorState(createPresentation());
  for (let i = 1; i < n; i++) s = editorReducer(s, { type: "addSlide" });
  return s;
};
const names = (s: EditorState) => s.presentation.slides.map((x) => x.name);

describe("slide naming", () => {
  it("never reuses a name after deleting from the middle", () => {
    let s = withSlides(2); // Slide 1, Slide 2
    s = editorReducer(s, { type: "deleteSlide", slideId: s.presentation.slides[0].id });
    s = editorReducer(s, { type: "addSlide" });
    expect(new Set(names(s)).size).toBe(names(s).length);
    expect(nextSlideName([])).toBe("Slide 1");
  });
});

describe("duplicateSlide", () => {
  it("copies content with new ids, inserts after the original and selects the copy", () => {
    let s = withSlides(2);
    const first = s.presentation.slides[0];
    s = editorReducer(s, { type: "setObjectText", slideId: first.id, objectId: first.objects[0].id, text: "Hello" });
    s = editorReducer(s, { type: "duplicateSlide", slideId: first.id });
    const [a, copy] = s.presentation.slides;
    expect(s.presentation.slides).toHaveLength(3);
    expect(copy.name).toBe(`${a.name} (copy)`);
    expect(copy.objects[0].text).toBe("Hello");
    expect(copy.id).not.toBe(a.id);
    expect(copy.objects[0].id).not.toBe(a.objects[0].id);
    expect(s.currentSlideId).toBe(copy.id);
    expect(parsePresentation(s.presentation).ok).toBe(true); // ids still unique
  });

  it("edits to the copy do not change the original", () => {
    const slide = createPresentation().slides[0];
    const copy = duplicateSlide(slide);
    copy.objects[0].text = "Changed";
    expect(slide.objects[0].text).not.toBe("Changed");
  });

  it("ignores an unknown slide", () => {
    const s = withSlides(1);
    expect(editorReducer(s, { type: "duplicateSlide", slideId: "nope" })).toBe(s);
  });
});

describe("renameSlide", () => {
  it("trims, caps length and ignores blank or unknown", () => {
    const s = withSlides(1);
    const id = s.currentSlideId;
    expect(names(editorReducer(s, { type: "renameSlide", slideId: id, name: "  Intro  " }))).toEqual(["Intro"]);
    expect(editorReducer(s, { type: "renameSlide", slideId: id, name: "   " })).toBe(s);
    expect(editorReducer(s, { type: "renameSlide", slideId: "nope", name: "X" })).toBe(s);
    const long = editorReducer(s, { type: "renameSlide", slideId: id, name: "x".repeat(300) });
    expect(long.presentation.slides[0].name).toHaveLength(100);
  });
});

describe("moveSlide", () => {
  it("reorders, keeps the same slide selected, and clamps the target", () => {
    let s = withSlides(3);
    const [a, b, c] = s.presentation.slides.map((x) => x.id);
    s = editorReducer(s, { type: "selectSlide", slideId: a });
    s = editorReducer(s, { type: "moveSlide", slideId: a, toIndex: 99 });
    expect(s.presentation.slides.map((x) => x.id)).toEqual([b, c, a]);
    expect(s.currentSlideId).toBe(a);
    s = editorReducer(s, { type: "moveSlide", slideId: a, toIndex: -5 });
    expect(s.presentation.slides.map((x) => x.id)).toEqual([a, b, c]);
  });

  it("is a no-op when the position does not change or the slide is unknown", () => {
    const s = withSlides(2);
    const id = s.presentation.slides[0].id;
    expect(editorReducer(s, { type: "moveSlide", slideId: id, toIndex: 0 })).toBe(s);
    expect(editorReducer(s, { type: "moveSlide", slideId: "nope", toIndex: 0 })).toBe(s);
  });
});

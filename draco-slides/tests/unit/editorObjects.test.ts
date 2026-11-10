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
    expect(s.presentation.schemaVersion).toBe(9);
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

describe("setTextFormat", () => {
  const withBox = () => {
    const s = addBox(fresh());
    return { s, id: boxes(s)[0].id };
  };

  it("applies valid changes to one object only", () => {
    const { s, id } = withBox();
    const other = objects(s).find((o) => o.id !== id)!;
    const e = editorReducer(s, { type: "setTextFormat", objectId: id, patch: { bold: true, fontFamily: "Georgia", fontSize: 36, color: "#FF0000" } });
    expect(boxes(e)[0]).toMatchObject({ bold: true, fontFamily: "Georgia", fontSize: 36, color: "#ff0000" });
    expect(objects(e).find((o) => o.id === other.id)).toEqual(other);
    expect(parsePresentation(e.presentation).ok).toBe(true);
  });

  it("clamps sizes and ignores invalid values", () => {
    const { s, id } = withBox();
    expect(boxes(editorReducer(s, { type: "setTextFormat", objectId: id, patch: { fontSize: 1 } }))[0].fontSize).toBe(6);
    expect(boxes(editorReducer(s, { type: "setTextFormat", objectId: id, patch: { fontSize: 5000 } }))[0].fontSize).toBe(400);
    const bad = { fontFamily: "Papyrus", color: "red", bold: "yes" };
    expect(editorReducer(s, { type: "setTextFormat", objectId: id, patch: bad })).toBe(s);
  });

  it("returns the same state when nothing changes or the object is unknown", () => {
    const { s, id } = withBox();
    expect(editorReducer(s, { type: "setTextFormat", objectId: id, patch: { bold: false, fontSize: 24 } })).toBe(s);
    expect(editorReducer(s, { type: "setTextFormat", objectId: "nope", patch: { bold: true } })).toBe(s);
  });

  it("can turn off the bold a title starts with", () => {
    const s0 = fresh();
    const title = objects(s0).find((o) => o.role === "title")!;
    expect(title.bold).toBe(true);
    const e = editorReducer(s0, { type: "setTextFormat", objectId: title.id, patch: { bold: false } });
    expect(objects(e).find((o) => o.id === title.id)!.bold).toBe(false);
  });
});

describe("setParagraphFormat", () => {
  const withBox = () => {
    const s = addBox(fresh());
    return { s, id: boxes(s)[0].id };
  };

  it("applies valid changes to one object only", () => {
    const { s, id } = withBox();
    const other = objects(s).find((o) => o.id !== id)!;
    const e = editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { align: "center", indent: 2, lineSpacing: 1.5 } });
    expect(boxes(e)[0]).toMatchObject({ align: "center", indent: 2, lineSpacing: 1.5, direction: "ltr" });
    expect(objects(e).find((o) => o.id === other.id)).toEqual(other);
    expect(parsePresentation(e.presentation).ok).toBe(true);
  });

  it("mirrors the alignment when switching to right-to-left, and back", () => {
    const { s, id } = withBox();
    const rtl = editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { direction: "rtl" } });
    expect(boxes(rtl)[0]).toMatchObject({ direction: "rtl", align: "right" });
    const ltr = editorReducer(rtl, { type: "setParagraphFormat", objectId: id, patch: { direction: "ltr" } });
    expect(boxes(ltr)[0]).toMatchObject({ direction: "ltr", align: "left" });
  });

  it("clamps indent and ignores invalid values", () => {
    const { s, id } = withBox();
    expect(boxes(editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { indent: 99 } }))[0].indent).toBe(8);
    expect(editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { align: "middle", indent: "2" } })).toBe(s);
  });

  it("returns the same state when nothing changes or the object is unknown", () => {
    const { s, id } = withBox();
    expect(editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { align: "left", indent: 0, lineSpacing: 1.2 } })).toBe(s);
    expect(editorReducer(s, { type: "setParagraphFormat", objectId: "nope", patch: { align: "right" } })).toBe(s);
  });
});

describe("lists in the reducer", () => {
  const withBox = (text = "a\nb") => {
    let s = addBox(fresh());
    const id = boxes(s)[0].id;
    s = editorReducer(s, { type: "setObjectText", slideId: s.currentSlideId, objectId: id, text });
    return { s, id };
  };

  it("setParagraphFormat switches between none, bullet and number", () => {
    const { s, id } = withBox();
    const bullet = editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { list: "bullet" } });
    expect(boxes(bullet)[0].list).toBe("bullet");
    const number = editorReducer(bullet, { type: "setParagraphFormat", objectId: id, patch: { list: "number" } });
    expect(boxes(number)[0].list).toBe("number");
    expect(editorReducer(number, { type: "setParagraphFormat", objectId: id, patch: { list: "number" } })).toBe(number);
    expect(parsePresentation(number.presentation).ok).toBe(true);
  });

  it("shiftListLevel moves every paragraph, only in a list", () => {
    const { s, id } = withBox("a\n\tb");
    expect(editorReducer(s, { type: "shiftListLevel", objectId: id, delta: 1 })).toBe(s); // not a list yet
    const list = editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { list: "bullet" } });
    const deeper = editorReducer(list, { type: "shiftListLevel", objectId: id, delta: 1 });
    expect(boxes(deeper)[0].text).toBe("\ta\n\t\tb");
    const back = editorReducer(deeper, { type: "shiftListLevel", objectId: id, delta: -1 });
    expect(boxes(back)[0].text).toBe("a\n\tb");
    // only the direction of the change matters: one level at a time
    expect(boxes(editorReducer(list, { type: "shiftListLevel", objectId: id, delta: 5 }))[0].text).toBe("\ta\n\t\tb");
  });

  it("shiftListLevel does nothing at the limits or for unknown objects", () => {
    const { s, id } = withBox("a");
    const list = editorReducer(s, { type: "setParagraphFormat", objectId: id, patch: { list: "number" } });
    expect(editorReducer(list, { type: "shiftListLevel", objectId: id, delta: -1 })).toBe(list);
    expect(editorReducer(list, { type: "shiftListLevel", objectId: "nope", delta: 1 })).toBe(list);
  });
});

describe("setBoxFormat", () => {
  const withBox = () => {
    const s = addBox(fresh());
    return { s, id: boxes(s)[0].id };
  };

  it("sets margins one side at a time, alignment and overflow", () => {
    const { s, id } = withBox();
    let e = editorReducer(s, { type: "setBoxFormat", objectId: id, patch: { margins: { left: 12 } } });
    e = editorReducer(e, { type: "setBoxFormat", objectId: id, patch: { margins: { top: 3 }, verticalAlign: "bottom", overflow: "visible" } });
    expect(boxes(e)[0]).toMatchObject({ margins: { top: 3, right: 0, bottom: 0, left: 12 }, verticalAlign: "bottom", overflow: "visible" });
    expect(parsePresentation(e.presentation).ok).toBe(true);
  });

  it("clamps margins and ignores invalid values", () => {
    const { s, id } = withBox();
    expect(boxes(editorReducer(s, { type: "setBoxFormat", objectId: id, patch: { margins: { top: 999 } } }))[0].margins.top).toBe(200);
    expect(editorReducer(s, { type: "setBoxFormat", objectId: id, patch: { verticalAlign: "center", margins: { left: "x" } } })).toBe(s);
  });

  it("returns the same state when nothing changes or the object is unknown", () => {
    const { s, id } = withBox();
    expect(editorReducer(s, { type: "setBoxFormat", objectId: id, patch: { verticalAlign: "top", overflow: "hidden", margins: { top: 0 } } })).toBe(s);
    expect(editorReducer(s, { type: "setBoxFormat", objectId: "nope", patch: { overflow: "visible" } })).toBe(s);
  });

  it("does not touch other objects", () => {
    const { s, id } = withBox();
    const other = objects(s).find((o) => o.id !== id)!;
    const e = editorReducer(s, { type: "setBoxFormat", objectId: id, patch: { overflow: "visible" } });
    expect(objects(e).find((o) => o.id === other.id)).toEqual(other);
  });
});


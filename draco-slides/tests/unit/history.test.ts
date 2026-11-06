import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { HISTORY_LIMIT, coalesceKeyFor, describeAction, historyReducer, initHistoryState, type HistoryAction, type HistoryState } from "../../src/state/history";

const base = () => initHistoryState(createPresentation("T"));
const run = (h: HistoryState, ...actions: HistoryAction[]) => actions.reduce(historyReducer, h);
const slides = (h: HistoryState) => h.present.presentation.slides;
const cur = (h: HistoryState) => slides(h).find((s) => s.id === h.present.currentSlideId)!;
const withBox = () => run(base(), { type: "addTextBox" });
const boxId = (h: HistoryState) => cur(h).objects.find((o) => o.role === "textbox")!.id;
const box = (h: HistoryState) => cur(h).objects.find((o) => o.role === "textbox");
const rect = (x: number, y = 230) => ({ x, y, width: 300, height: 80 });

describe("basic undo and redo", () => {
  it("starts empty and ignores undo or redo with nothing to do", () => {
    const h = base();
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(historyReducer(h, { type: "undo" })).toBe(h);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("undoes and redoes a slide being added, including which slide you were on", () => {
    const first = slides(base())[0].id;
    let h = run(base(), { type: "addSlide" });
    expect(h.past).toHaveLength(1);
    expect(slides(h)).toHaveLength(2);
    h = run(h, { type: "undo" });
    expect(slides(h)).toHaveLength(1);
    expect(h.present.currentSlideId).toBe(first);
    expect(h.future).toHaveLength(1);
    h = run(h, { type: "redo" });
    expect(slides(h)).toHaveLength(2);
    expect(h.present.currentSlideId).toBe(slides(h)[1].id);
    expect(h.future).toHaveLength(0);
  });

  it("undo restores exactly the earlier document", () => {
    const before = withBox();
    const after = run(before, { type: "setObjectRect", objectId: boxId(before), rect: rect(500) });
    expect(slides(run(after, { type: "undo" }))).toEqual(slides(before));
  });

  it("a new change after an undo discards the redo history", () => {
    let h = run(base(), { type: "addSlide" }, { type: "undo" });
    expect(h.future).toHaveLength(1);
    h = run(h, { type: "addSlide" });
    expect(h.future).toHaveLength(0);
  });

  it("undoing several steps and redoing them again walks back and forth", () => {
    let h = run(base(), { type: "addSlide" }, { type: "addSlide" }, { type: "addSlide" });
    expect(slides(h)).toHaveLength(4);
    h = run(h, { type: "undo" }, { type: "undo" });
    expect(slides(h)).toHaveLength(2);
    h = run(h, { type: "redo" });
    expect(slides(h)).toHaveLength(3);
  });

  it("restores a deleted slide at its old position", () => {
    let h = run(base(), { type: "addSlide" }, { type: "addSlide" });
    const order = slides(h).map((s) => s.id);
    h = run(h, { type: "deleteSlide", slideId: order[1] });
    expect(slides(h).map((s) => s.id)).toEqual([order[0], order[2]]);
    h = run(h, { type: "undo" });
    expect(slides(h).map((s) => s.id)).toEqual(order);
  });
});

describe("what is recorded", () => {
  it("does not record selection, navigation or editing state", () => {
    const h = withBox();
    const id = boxId(h);
    const steps = h.past.length;
    const moved = run(h, { type: "selectObject", objectId: null }, { type: "selectObject", objectId: id }, { type: "startEditing", objectId: id }, { type: "stopEditing" }, { type: "selectAllObjects" });
    expect(moved.past).toHaveLength(steps);
    expect(moved.present).not.toBe(h.present);
    const slideChange = run(run(h, { type: "addSlide" }), { type: "selectSlide", slideId: slides(h)[0].id });
    expect(slideChange.past).toHaveLength(steps + 1);
  });

  it("does not record actions that change nothing", () => {
    const h = withBox();
    const same = historyReducer(h, { type: "setObjectRect", objectId: boxId(h), rect: rect(330) });
    expect(same).toBe(h);
    expect(historyReducer(h, { type: "selectObject", objectId: boxId(h) })).toBe(h);
  });

  it("records structural changes: groups, locks, deletes and formatting", () => {
    let h = run(base(), { type: "selectAllObjects" });
    h = run(h, { type: "groupSelection" });
    expect(cur(h).objects.every((o) => o.groupId !== null)).toBe(true);
    h = run(h, { type: "undo" });
    expect(cur(h).objects.every((o) => o.groupId === null)).toBe(true);
    h = run(h, { type: "redo" }, { type: "setObjectsLocked", locked: true });
    expect(cur(h).objects.every((o) => o.locked)).toBe(true);
    h = run(h, { type: "undo" });
    expect(cur(h).objects.every((o) => !o.locked)).toBe(true);
    expect(cur(h).objects.every((o) => o.groupId !== null)).toBe(true);
  });

  it("undoes formatting", () => {
    const h = withBox();
    const bold = run(h, { type: "setTextFormat", objectId: boxId(h), patch: { bold: true } });
    expect(box(bold)!.bold).toBe(true);
    expect(box(run(bold, { type: "undo" }))!.bold).toBe(false);
  });
});

describe("merging continuous changes into one step", () => {
  it("a stream of moves of one object is one undo step", () => {
    const h0 = withBox();
    const id = boxId(h0);
    let h = h0;
    for (let x = 340; x <= 380; x += 10) h = run(h, { type: "setObjectRect", objectId: id, rect: rect(x) });
    expect(h.past).toHaveLength(2); // insert + one merged move
    h = run(h, { type: "undo" });
    expect(box(h)!.x).toBe(330);
    expect(h.past).toHaveLength(1);
    h = run(h, { type: "undo" });
    expect(box(h)).toBeUndefined();
  });

  it("breakHistory ends the run, so the next stream is a new step", () => {
    const h0 = withBox();
    const id = boxId(h0);
    let h = run(h0, { type: "setObjectRect", objectId: id, rect: rect(340) }, { type: "setObjectRect", objectId: id, rect: rect(350) });
    h = run(h, { type: "breakHistory" }, { type: "setObjectRect", objectId: id, rect: rect(360) }, { type: "setObjectRect", objectId: id, rect: rect(370) });
    expect(h.past).toHaveLength(3);
    h = run(h, { type: "undo" });
    expect(box(h)!.x).toBe(350);
    h = run(h, { type: "undo" });
    expect(box(h)!.x).toBe(330);
  });

  it("breakHistory with no run in progress changes nothing", () => {
    const h = withBox();
    expect(historyReducer(h, { type: "breakHistory" })).toBe(h);
  });

  it("different objects or different kinds of change are separate steps", () => {
    let h = run(base(), { type: "addTextBox" }, { type: "addTextBox" });
    const [a, b] = h.present.presentation.slides[0].objects.filter((o) => o.role === "textbox").map((o) => o.id);
    h = run(h, { type: "setObjectRect", objectId: a, rect: rect(100, 100) }, { type: "setObjectRect", objectId: b, rect: rect(200, 200) });
    expect(h.past).toHaveLength(4);
    h = run(h, { type: "setTextFormat", objectId: a, patch: { bold: true } }, { type: "setObjectRect", objectId: a, rect: rect(120, 120) });
    expect(h.past).toHaveLength(6);
  });

  it("typing in one editing session is one step; a later session is another", () => {
    const h0 = withBox();
    const id = boxId(h0);
    const slideId = h0.present.currentSlideId;
    const type = (text: string): HistoryAction => ({ type: "setObjectText", slideId, objectId: id, text });
    let h = run(h0, { type: "startEditing", objectId: id }, type("a"), type("ab"), type("abc"), { type: "stopEditing" });
    expect(h.past).toHaveLength(2);
    h = run(h, { type: "startEditing", objectId: id }, type("abcd"), type("abcde"), { type: "stopEditing" });
    expect(h.past).toHaveLength(3);
    h = run(h, { type: "undo" });
    expect(box(h)!.text).toBe("abc");
    h = run(h, { type: "undo" });
    expect(box(h)!.text).toBe("Text box");
  });

  it("changing the selection between two streams separates them", () => {
    const h0 = withBox();
    const id = boxId(h0);
    let h = run(h0, { type: "setObjectRect", objectId: id, rect: rect(340) });
    h = run(h, { type: "selectObjects", objectIds: [] }, { type: "selectObject", objectId: id }, { type: "setObjectRect", objectId: id, rect: rect(350) });
    expect(h.past).toHaveLength(3);
  });

  it("a stream of color changes is one step, but other formatting is not merged", () => {
    const h0 = withBox();
    const id = boxId(h0);
    let h = run(h0, { type: "setTextFormat", objectId: id, patch: { color: "#ff0000" } }, { type: "setTextFormat", objectId: id, patch: { color: "#00ff00" } }, { type: "setTextFormat", objectId: id, patch: { color: "#0000ff" } });
    expect(h.past).toHaveLength(2);
    h = run(h, { type: "setTextFormat", objectId: id, patch: { bold: true } }, { type: "setTextFormat", objectId: id, patch: { italic: true } });
    expect(h.past).toHaveLength(4);
    h = run(h, { type: "undo" }, { type: "undo" }, { type: "undo" });
    expect(box(h)!.color).toBe("#1d1d1d");
  });

  it("title typing in the header is one step", () => {
    let h = base();
    for (const t of ["A", "Ab", "Abc"]) h = run(h, { type: "renamePresentation", title: t });
    expect(h.past).toHaveLength(1);
    expect(run(h, { type: "undo" }).present.presentation.title).toBe("T");
  });

  it("coalesceKeyFor and describeAction cover the streaming and structural actions", () => {
    expect(coalesceKeyFor({ type: "setObjectRect", objectId: "o", rect: rect(1) })).toBe("rect:o");
    expect(coalesceKeyFor({ type: "setObjectRects", rects: { b: rect(1), a: rect(2) } })).toBe("rect:a,b");
    expect(coalesceKeyFor({ type: "setObjectText", slideId: "s", objectId: "o", text: "" })).toBe("text:o");
    expect(coalesceKeyFor({ type: "setTextFormat", objectId: "o", patch: { color: "#fff" } })).toBe("color:o");
    expect(coalesceKeyFor({ type: "setTextFormat", objectId: "o", patch: { color: "#fff", bold: true } })).toBeNull();
    expect(coalesceKeyFor({ type: "addSlide" })).toBeNull();
    expect(describeAction({ type: "setObjectRect", objectId: "o", rect: rect(1) })).toBe("Move or resize");
    expect(describeAction({ type: "setObjectsLocked", locked: true })).toBe("Lock");
    expect(describeAction({ type: "setObjectsLocked", locked: false })).toBe("Unlock");
    expect(describeAction({ type: "deleteSelection" })).toBe("Delete");
    expect(describeAction({ type: "selectAllObjects" })).toBe("Edit");
  });
});

describe("context restored with an undo", () => {
  it("brings back the selection from before the change", () => {
    const h0 = withBox();
    const id = boxId(h0);
    const moved = run(h0, { type: "setObjectRect", objectId: id, rect: rect(500) });
    expect(run(moved, { type: "selectObjects", objectIds: [] }, { type: "undo" }).present.selectedObjectIds).toEqual([id]);
    const inserted = run(base(), { type: "addTextBox" });
    expect(inserted.present.selectedObjectIds).toHaveLength(1);
    expect(run(inserted, { type: "undo" }).present.selectedObjectIds).toEqual([]);
  });

  it("only selects objects that still exist", () => {
    let h = run(withBox());
    const id = boxId(h);
    h = run(h, { type: "setObjectRect", objectId: id, rect: rect(400) }, { type: "undo" }, { type: "undo" });
    expect(h.present.selectedObjectIds).toEqual([]); // the box does not exist before it was inserted
    expect(h.present.selectedObjectId).toBeNull();
  });

  it("ends text editing", () => {
    const h0 = withBox();
    const id = boxId(h0);
    const slideId = h0.present.currentSlideId;
    let h = run(h0, { type: "startEditing", objectId: id }, { type: "setObjectText", slideId, objectId: id, text: "typed" });
    expect(h.present.editingObjectId).toBe(id);
    h = run(h, { type: "undo" });
    expect(h.present.editingObjectId).toBeNull();
    expect(box(h)!.text).toBe("Text box");
  });

  it("the undo and redo labels name the change", () => {
    const h0 = withBox();
    const h = run(h0, { type: "setObjectRect", objectId: boxId(h0), rect: rect(500) });
    expect(h.past[h.past.length - 1].label).toBe("Move or resize");
    const undone = run(h, { type: "undo" });
    expect(undone.future[undone.future.length - 1].label).toBe("Move or resize");
    expect(undone.past[undone.past.length - 1].label).toBe("Insert text box");
  });
});

describe("limits", () => {
  it("keeps at most HISTORY_LIMIT steps, dropping the oldest", () => {
    let h = base();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = run(h, { type: "addSlide" });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(slides(h)).toHaveLength(HISTORY_LIMIT + 21);
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = run(h, { type: "undo" });
    expect(h.past).toHaveLength(0);
    expect(slides(h)).toHaveLength(21); // the 20 oldest additions can no longer be undone
  });

  it("redo respects the limit too", () => {
    let h = base();
    for (let i = 0; i < HISTORY_LIMIT; i++) h = run(h, { type: "addSlide" });
    h = run(h, { type: "undo" }, { type: "redo" });
    expect(h.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });

  it("shares data between snapshots instead of copying it", () => {
    const h = run(base(), { type: "addSlide" });
    expect(h.past[0].presentation.slides[0]).toBe(h.present.presentation.slides[0]);
  });
});

import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { appReducer, initialAppState } from "../../src/state/appReducer";

describe("appReducer", () => {
  it("starts on Home with nothing open", () => {
    expect(initialAppState.view).toBe("home");
    expect(initialAppState.presentation).toBeNull();
  });

  it("opening a presentation switches to the editor", () => {
    const p = createPresentation();
    const s = appReducer(initialAppState, { type: "openPresentation", presentation: p });
    expect(s.view).toBe("editor");
    expect(s.presentation).toBe(p);
  });

  it("refuses to navigate to the editor with no presentation", () => {
    expect(appReducer(initialAppState, { type: "navigate", view: "editor" })).toBe(initialAppState);
  });

  it("keeps the open presentation when navigating Home and back", () => {
    let s = appReducer(initialAppState, { type: "openPresentation", presentation: createPresentation() });
    s = appReducer(s, { type: "navigate", view: "home" });
    expect(s.presentation).not.toBeNull();
    s = appReducer(s, { type: "navigate", view: "editor" });
    expect(s.view).toBe("editor");
  });

  it("closing returns Home and clears the presentation", () => {
    let s = appReducer(initialAppState, { type: "openPresentation", presentation: createPresentation() });
    s = appReducer(s, { type: "closePresentation" });
    expect(s.view).toBe("home");
    expect(s.presentation).toBeNull();
  });

  it("adds and dismisses notices", () => {
    let s = appReducer(initialAppState, { type: "notify", notice: { id: "a", kind: "error", message: "x" } });
    expect(s.notices).toHaveLength(1);
    s = appReducer(s, { type: "dismissNotice", id: "a" });
    expect(s.notices).toHaveLength(0);
  });
});

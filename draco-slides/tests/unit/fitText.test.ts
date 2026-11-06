import { afterEach, describe, expect, it } from "vitest";
import { fitBoxHeight, fitFontSize, hasLayout, textOverflows } from "../../src/features/canvas/fitText";

/** A text element whose layout is simulated: `lines` lines of 1.2 x font size, in a box of the given size. */
function textEl(opts: { lines: number; width?: number; height?: number; wideText?: number }) {
  const el = document.createElement("div");
  const box = { width: opts.width ?? 300, height: opts.height ?? 100 };
  const size = () => parseFloat(el.style.fontSize) || 24;
  const content = () => Math.ceil(opts.lines * size() * 1.2);
  Object.defineProperty(el, "clientWidth", { get: () => box.width });
  Object.defineProperty(el, "clientHeight", { get: () => box.height });
  Object.defineProperty(el, "scrollWidth", { get: () => Math.max(box.width, opts.wideText ? opts.wideText * size() : 0) });
  Object.defineProperty(el, "scrollHeight", { get: () => Math.max(box.height, content()) });
  Object.defineProperty(el, "offsetHeight", { get: () => (el.style.height === "auto" ? content() : box.height) });
  el.style.fontSize = "24px";
  el.style.justifyContent = "center";
  el.style.height = "100px";
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("hasLayout / textOverflows", () => {
  it("an element without layout cannot be measured", () => {
    expect(hasLayout(document.createElement("div"))).toBe(false);
    expect(hasLayout(textEl({ lines: 1 }))).toBe(true);
  });

  it("detects text taller or wider than the box, with a pixel of tolerance", () => {
    expect(textOverflows(textEl({ lines: 1 }))).toBe(false); // 29px in 100px
    expect(textOverflows(textEl({ lines: 5 }))).toBe(true); // 144px in 100px
    expect(textOverflows(textEl({ lines: 1, wideText: 20 }))).toBe(true); // 480px wide in 300px
    expect(textOverflows(textEl({ lines: 3, height: 87 }))).toBe(false); // 87px content in 87px box
  });
});

describe("fitFontSize", () => {
  it("shrinks until the text fits, never above the current size", () => {
    const el = textEl({ lines: 5 });
    expect(fitFontSize(el, 24)).toEqual({ size: 16.5, fits: true });
    expect(fitFontSize(textEl({ lines: 1 }), 24)).toEqual({ size: 24, fits: true }); // already fits: unchanged
  });

  it("restores the element's own styles after measuring", () => {
    const el = textEl({ lines: 5 });
    fitFontSize(el, 24);
    expect(el.style.fontSize).toBe("24px");
    expect(el.style.justifyContent).toBe("center");
    expect(el.style.height).toBe("100px");
  });

  it("measures wide text too", () => {
    const el = textEl({ lines: 1, wideText: 20 }); // 20 px of width per font px: 300 / 20 = 15
    expect(fitFontSize(el, 24)).toEqual({ size: 15, fits: true });
  });

  it("reports when even the smallest size does not fit", () => {
    expect(fitFontSize(textEl({ lines: 100 }), 24)).toEqual({ size: 6, fits: false });
  });

  it("returns null without layout", () => {
    expect(fitFontSize(document.createElement("div"), 24)).toBeNull();
  });
});

describe("fitBoxHeight", () => {
  it("returns the height that holds the text and restores the styles", () => {
    const el = textEl({ lines: 5 });
    expect(fitBoxHeight(el)).toBe(144); // 5 * 24 * 1.2
    expect(el.style.height).toBe("100px");
    expect(el.style.justifyContent).toBe("center");
  });

  it("returns null without layout", () => {
    expect(fitBoxHeight(document.createElement("div"))).toBeNull();
  });
});

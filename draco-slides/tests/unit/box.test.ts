import { describe, expect, it } from "vitest";
import {
  MAX_MARGIN,
  applyBoxPatch,
  boxEqual,
  defaultBoxFormat,
  isValidMargins,
  marginPatch,
  sanitizeBoxPatch,
} from "../../src/core/document-model/box";
import { defaultParagraphFormat } from "../../src/core/document-model/paragraph";
import { defaultTextFormat } from "../../src/core/document-model/fonts";
import { textClassNames, textStyle } from "../../src/features/editor/textStyle";

describe("sanitizeBoxPatch", () => {
  it("keeps valid values and rounds margins to half a pixel", () => {
    expect(sanitizeBoxPatch({ verticalAlign: "middle", overflow: "visible", margins: { top: 10.3, left: 4 } })).toEqual({
      verticalAlign: "middle",
      overflow: "visible",
      margins: { top: 10.5, left: 4 },
    });
  });

  it("clamps margins to 0..200", () => {
    expect(sanitizeBoxPatch({ margins: { top: -5, right: 9999 } }).margins).toEqual({ top: 0, right: MAX_MARGIN });
  });

  it("drops invalid values", () => {
    expect(sanitizeBoxPatch({ verticalAlign: "center", overflow: "scroll", margins: { top: "5", left: Number.NaN, right: Infinity } })).toEqual({});
    expect(sanitizeBoxPatch({ margins: null as unknown as undefined })).toEqual({});
    expect(sanitizeBoxPatch({})).toEqual({});
  });

  it("marginPatch builds a one-side change", () => {
    expect(marginPatch("left", 12)).toEqual({ margins: { left: 12 } });
  });
});

describe("applyBoxPatch / boxEqual / isValidMargins", () => {
  const base = defaultBoxFormat();

  it("changes only the sides that are given", () => {
    const next = applyBoxPatch(base, { margins: { left: 12 } });
    expect(next.margins).toEqual({ top: 0, right: 0, bottom: 0, left: 12 });
    expect(next.verticalAlign).toBe("top");
    expect(base.margins.left).toBe(0); // input untouched
  });

  it("compares formats", () => {
    expect(boxEqual(base, defaultBoxFormat())).toBe(true);
    expect(boxEqual(base, applyBoxPatch(base, { margins: { bottom: 1 } }))).toBe(false);
    expect(boxEqual(base, applyBoxPatch(base, { overflow: "visible" }))).toBe(false);
    expect(boxEqual(base, applyBoxPatch(base, { verticalAlign: "bottom" }))).toBe(false);
  });

  it("validates margin objects", () => {
    expect(isValidMargins({ top: 0, right: 1, bottom: 200, left: 5.5 })).toBe(true);
    for (const bad of [null, {}, { top: 0, right: 0, bottom: 0 }, { top: -1, right: 0, bottom: 0, left: 0 }, { top: 0, right: 0, bottom: 0, left: 201 }, { top: "0", right: 0, bottom: 0, left: 0 }, "x"]) {
      expect(isValidMargins(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("rendering of box settings", () => {
  const full = { ...defaultTextFormat("body"), ...defaultParagraphFormat(), ...defaultBoxFormat() };

  it("margins become padding; none means no padding at all", () => {
    const none = textStyle(full);
    expect(none.paddingTop).toBeUndefined();
    expect(none.paddingLeft).toBeUndefined();
    const s = textStyle({ ...full, margins: { top: 4, right: 8, bottom: 6, left: 10 } });
    expect(s).toMatchObject({ paddingTop: 4, paddingRight: 8, paddingBottom: 6, paddingLeft: 10 });
  });

  it("the indent adds to the margin on the reading-start side", () => {
    const margins = { top: 0, right: 8, bottom: 0, left: 10 };
    expect(textStyle({ ...full, margins, indent: 2 })).toMatchObject({ paddingLeft: 82, paddingRight: 8 });
    expect(textStyle({ ...full, margins, indent: 2, direction: "rtl" })).toMatchObject({ paddingLeft: 10, paddingRight: 80 });
  });

  it("class names follow vertical alignment, overflow and list", () => {
    expect(textClassNames(full)).toBe("");
    expect(textClassNames({ ...full, verticalAlign: "middle" })).toBe(" rt-v--middle");
    expect(textClassNames({ ...full, verticalAlign: "bottom", overflow: "visible", list: "number" })).toBe(
      " rt-list rt-list--number rt-v--bottom rt-overflow--visible",
    );
  });
});

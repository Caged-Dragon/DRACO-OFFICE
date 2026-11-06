import { describe, expect, it } from "vitest";
import {
  DEFAULT_LINE_SPACING,
  INDENT_STEP,
  MAX_INDENT_LEVEL,
  MAX_LINE_SPACING,
  MIN_LINE_SPACING,
  applyParagraphPatch,
  defaultParagraphFormat,
  paragraphEqual,
  paragraphPatch,
  sanitizeParagraphPatch,
} from "../../src/core/document-model/paragraph";
import { defaultBoxFormat } from "../../src/core/document-model/box";
import { defaultTextFormat } from "../../src/core/document-model/fonts";
import { textStyle } from "../../src/features/editor/textStyle";

describe("sanitizeParagraphPatch", () => {
  it("keeps valid values", () => {
    expect(sanitizeParagraphPatch({ align: "justify", direction: "rtl", indent: 3, lineSpacing: 1.5 })).toEqual({
      align: "justify",
      direction: "rtl",
      indent: 3,
      lineSpacing: 1.5,
    });
  });

  it("clamps and rounds numbers", () => {
    expect(sanitizeParagraphPatch({ indent: -4 }).indent).toBe(0);
    expect(sanitizeParagraphPatch({ indent: 99 }).indent).toBe(MAX_INDENT_LEVEL);
    expect(sanitizeParagraphPatch({ indent: 2.6 }).indent).toBe(3);
    expect(sanitizeParagraphPatch({ lineSpacing: 0 }).lineSpacing).toBe(MIN_LINE_SPACING);
    expect(sanitizeParagraphPatch({ lineSpacing: 50 }).lineSpacing).toBe(MAX_LINE_SPACING);
    expect(sanitizeParagraphPatch({ lineSpacing: 1.2349 }).lineSpacing).toBe(1.23);
  });

  it("accepts the three list styles and drops anything else", () => {
    for (const list of ["none", "bullet", "number"]) expect(sanitizeParagraphPatch({ list })).toEqual({ list });
    expect(sanitizeParagraphPatch({ list: "roman" })).toEqual({});
    expect(sanitizeParagraphPatch({ list: 1 })).toEqual({});
  });

  it("drops invalid values", () => {
    expect(sanitizeParagraphPatch({ align: "middle", direction: "up", indent: Number.NaN, lineSpacing: "2" })).toEqual({});
    expect(sanitizeParagraphPatch({ align: 5, indent: Number.POSITIVE_INFINITY })).toEqual({});
  });

  it("paragraphPatch builds a one-field patch", () => {
    expect(paragraphPatch("align", "center")).toEqual({ align: "center" });
  });
});

describe("applyParagraphPatch", () => {
  const base = defaultParagraphFormat();

  it("has the defaults the app already rendered", () => {
    expect(base).toEqual({ align: "left", indent: 0, lineSpacing: DEFAULT_LINE_SPACING, direction: "ltr", list: "none" });
  });

  it("mirrors left and right alignment when the direction changes", () => {
    expect(applyParagraphPatch(base, { direction: "rtl" }).align).toBe("right");
    expect(applyParagraphPatch({ ...base, direction: "rtl", align: "right" }, { direction: "ltr" }).align).toBe("left");
  });

  it("leaves centered and justified text alone when the direction changes", () => {
    expect(applyParagraphPatch({ ...base, align: "center" }, { direction: "rtl" }).align).toBe("center");
    expect(applyParagraphPatch({ ...base, align: "justify" }, { direction: "rtl" }).align).toBe("justify");
  });

  it("respects an explicit alignment in the same change, and does nothing when the direction is unchanged", () => {
    expect(applyParagraphPatch(base, { direction: "rtl", align: "left" }).align).toBe("left");
    expect(applyParagraphPatch(base, { direction: "ltr" }).align).toBe("left");
    expect(applyParagraphPatch({ ...base, align: "right" }, { indent: 1 }).align).toBe("right");
  });

  it("compares formats", () => {
    expect(paragraphEqual(base, { ...base })).toBe(true);
    expect(paragraphEqual(base, { ...base, indent: 1 })).toBe(false);
    expect(paragraphEqual(base, { ...base, list: "bullet" })).toBe(false);
  });
});

describe("textStyle with paragraph settings", () => {
  const f = { ...defaultTextFormat("body"), ...defaultParagraphFormat(), ...defaultBoxFormat() };

  it("maps alignment, line spacing and indent", () => {
    expect(textStyle(f)).toMatchObject({ textAlign: "left", lineHeight: 1.2 });
    expect(textStyle(f).paddingLeft).toBeUndefined();
    const s = textStyle({ ...f, align: "center", lineSpacing: 2, indent: 2 });
    expect(s).toMatchObject({ textAlign: "center", lineHeight: 2, paddingLeft: 2 * INDENT_STEP });
    expect(s.paddingRight).toBeUndefined();
  });

  it("puts the indent on the reading-start side for right-to-left text", () => {
    const s = textStyle({ ...f, direction: "rtl", align: "right", indent: 1 });
    expect(s.paddingRight).toBe(INDENT_STEP);
    expect(s.paddingLeft).toBeUndefined();
  });
});

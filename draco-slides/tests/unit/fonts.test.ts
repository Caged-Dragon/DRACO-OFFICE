import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  FONT_FAMILIES,
  FONT_FAMILY_NAMES,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  cssFontFamily,
  defaultTextFormat,
  formatPatch,
  nextFontSize,
  normalizeColor,
  sanitizeTextFormatPatch,
} from "../../src/core/document-model/fonts";
import { defaultBoxFormat } from "../../src/core/document-model/box";
import { defaultParagraphFormat } from "../../src/core/document-model/paragraph";
import { textStyle } from "../../src/features/editor/textStyle";

const full = (f: ReturnType<typeof defaultTextFormat>) => ({ ...f, ...defaultParagraphFormat(), ...defaultBoxFormat() });

describe("font families", () => {
  it("has a default that is in the list, and a CSS stack with fallbacks for every font", () => {
    expect(FONT_FAMILY_NAMES).toContain(DEFAULT_FONT_FAMILY);
    for (const f of FONT_FAMILIES) {
      expect(cssFontFamily(f.name)).toContain(f.name.split(" ")[0]);
      expect(cssFontFamily(f.name)).toMatch(/serif|monospace|sans-serif/);
    }
    expect(cssFontFamily("Comic Sans MS")).toBe(cssFontFamily(DEFAULT_FONT_FAMILY)); // unknown falls back
  });
});

describe("font size steps", () => {
  it("steps up and down through the presets and stops at the limits", () => {
    expect(nextFontSize(24, 1)).toBe(28);
    expect(nextFontSize(24, -1)).toBe(20);
    expect(nextFontSize(25, 1)).toBe(28);
    expect(nextFontSize(25, -1)).toBe(24);
    expect(nextFontSize(MAX_FONT_SIZE, 1)).toBe(MAX_FONT_SIZE);
    expect(nextFontSize(8, -1)).toBe(MIN_FONT_SIZE);
    expect(nextFontSize(MIN_FONT_SIZE, -1)).toBe(MIN_FONT_SIZE);
  });
});

describe("normalizeColor", () => {
  it("accepts #rgb and #rrggbb in any case, rejects everything else", () => {
    expect(normalizeColor("#FF0000")).toBe("#ff0000");
    expect(normalizeColor("#f00")).toBe("#ff0000");
    expect(normalizeColor("  #1D1D1D ")).toBe("#1d1d1d");
    for (const bad of ["red", "#ff00", "#gggggg", "rgb(1,2,3)", "", "#1234567", 5, null, undefined]) {
      expect(normalizeColor(bad), String(bad)).toBeNull();
    }
  });
});

describe("defaultTextFormat", () => {
  it("makes titles bold and larger", () => {
    expect(defaultTextFormat("title")).toMatchObject({ bold: true, fontSize: 44 });
    expect(defaultTextFormat("body")).toMatchObject({ bold: false, fontSize: 24 });
    expect(defaultTextFormat("textbox")).toMatchObject({ bold: false, fontSize: 24, color: "#1d1d1d" });
  });
});

describe("sanitizeTextFormatPatch", () => {
  it("keeps valid fields, clamps and rounds sizes, normalizes colors", () => {
    expect(sanitizeTextFormatPatch({ fontFamily: "Georgia", bold: true, color: "#ABC" })).toEqual({
      fontFamily: "Georgia",
      bold: true,
      color: "#aabbcc",
    });
    expect(sanitizeTextFormatPatch({ fontSize: 1 }).fontSize).toBe(MIN_FONT_SIZE);
    expect(sanitizeTextFormatPatch({ fontSize: 99999 }).fontSize).toBe(MAX_FONT_SIZE);
    expect(sanitizeTextFormatPatch({ fontSize: 17.26 }).fontSize).toBe(17.5);
  });

  it("drops invalid values instead of applying them", () => {
    expect(
      sanitizeTextFormatPatch({
        fontFamily: "Comic Sans MS",
        fontSize: Number.NaN,
        bold: "yes",
        italic: 1,
        color: "red; background:url(x)",
      }),
    ).toEqual({});
    expect(sanitizeTextFormatPatch({ underline: false, strike: true })).toEqual({ underline: false, strike: true });
  });

  it("formatPatch builds a one-field patch", () => {
    expect(formatPatch("bold", true)).toEqual({ bold: true });
  });
});

describe("textStyle", () => {
  it("maps formatting to CSS", () => {
    const plain = textStyle(full(defaultTextFormat("body")));
    expect(plain).toMatchObject({ fontSize: 24, fontWeight: 400, fontStyle: "normal", textDecoration: "none", color: "#1d1d1d" });
    const all = textStyle(full({ ...defaultTextFormat("title"), italic: true, underline: true, strike: true, color: "#ff0000", fontFamily: "Georgia" }));
    expect(all).toMatchObject({ fontWeight: 700, fontStyle: "italic", textDecoration: "underline line-through", color: "#ff0000" });
    expect(String(all.fontFamily)).toContain("Georgia");
    expect(textStyle(full({ ...defaultTextFormat("body"), underline: true })).textDecoration).toBe("underline");
    expect(textStyle(full({ ...defaultTextFormat("body"), strike: true })).textDecoration).toBe("line-through");
  });
});

import { describe, expect, it } from "vitest";
import { MAX_LIST_LEVEL, clampLevel, joinLines, levelRange, shiftLevels, splitLines } from "../../src/core/document-model/lists";

describe("splitLines / joinLines", () => {
  it("reads leading tabs as levels", () => {
    expect(splitLines("a\n\tb\n\t\tc\n\td")).toEqual([
      { level: 0, content: "a" },
      { level: 1, content: "b" },
      { level: 2, content: "c" },
      { level: 1, content: "d" },
    ]);
  });

  it("handles empty text, empty lines and CRLF", () => {
    expect(splitLines("")).toEqual([{ level: 0, content: "" }]);
    expect(splitLines("a\r\n\r\n\tb")).toEqual([
      { level: 0, content: "a" },
      { level: 0, content: "" },
      { level: 1, content: "b" },
    ]);
    expect(splitLines("\t\t")).toEqual([{ level: 2, content: "" }]);
  });

  it("keeps tabs beyond the maximum level as content, so nothing is lost", () => {
    const text = "\t".repeat(MAX_LIST_LEVEL + 2) + "x";
    const [line] = splitLines(text);
    expect(line.level).toBe(MAX_LIST_LEVEL);
    expect(line.content).toBe("\t\tx");
    expect(joinLines([line])).toBe(text);
  });

  it("round-trips", () => {
    for (const t of ["", "a", "a\n\tb", "\t\ta\n\n\tb\n", "x\ty", "\t"]) expect(joinLines(splitLines(t)), JSON.stringify(t)).toBe(t);
  });
});

describe("shiftLevels", () => {
  it("indents and outdents every line, stopping at the ends", () => {
    expect(shiftLevels("a\n\tb", 1)).toBe("\ta\n\t\tb");
    expect(shiftLevels("\ta\n\t\tb", -1)).toBe("a\n\tb");
    expect(shiftLevels("a\nb", -1)).toBe("a\nb");
    const max = "\t".repeat(MAX_LIST_LEVEL) + "a";
    expect(shiftLevels(max, 1)).toBe(max);
  });

  it("indents empty lines too", () => {
    expect(shiftLevels("a\n\nb", 1)).toBe("\ta\n\t\n\tb");
  });
});

describe("levelRange / clampLevel", () => {
  it("reports the lowest and highest level", () => {
    expect(levelRange("a\n\t\tb\n\tc")).toEqual({ min: 0, max: 2 });
    expect(levelRange("\ta\n\tb")).toEqual({ min: 1, max: 1 });
    expect(levelRange("")).toEqual({ min: 0, max: 0 });
  });

  it("clamps and tolerates bad numbers", () => {
    expect(clampLevel(-3)).toBe(0);
    expect(clampLevel(99)).toBe(MAX_LIST_LEVEL);
    expect(clampLevel(2.4)).toBe(2);
    expect(clampLevel(Number.NaN)).toBe(0);
  });
});

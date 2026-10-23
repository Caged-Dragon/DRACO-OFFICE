import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { MAX_OBJECTS_PER_SLIDE, MAX_SLIDES } from "../../src/core/document-model/types";
import {
  FILE_EXTENSION,
  MAX_FILE_BYTES,
  deserializePresentation,
  fileNameFor,
  serializePresentation,
} from "../../src/core/serialization/serialize";
import { validatePresentation } from "../../src/core/validation/validatePresentation";

const wrap = (presentation: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: "draco-slides", formatVersion: 1, presentation, ...extra });
const errorOf = (text: string) => {
  const r = deserializePresentation(text);
  return r.ok ? "" : r.error;
};

describe("serialize / deserialize", () => {
  it("round-trips a presentation exactly", () => {
    const p = createPresentation("Round trip", { size: "4:3", author: "Ana", createdWith: "0.9.0" });
    p.slides.push({ ...p.slides[0], id: "extra", objects: p.slides[0].objects.map((o, i) => ({ ...o, id: `x${i}` })) });
    const text = serializePresentation(p, "0.9.0", new Date("2026-10-22T10:00:00Z"));
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ format: "draco-slides", formatVersion: 1, savedWith: "0.9.0", savedAt: "2026-10-22T10:00:00.000Z" });
    const r = deserializePresentation(text);
    expect(r.ok && r.presentation).toEqual(p);
  });

  it("rejects text that is not JSON, not our format, or empty", () => {
    expect(errorOf("not json")).toContain("not valid JSON");
    expect(errorOf("")).toContain("not valid JSON");
    expect(errorOf("[1,2]")).toContain("not a Draco Slides file");
    expect(errorOf(JSON.stringify({ format: "other" }))).toContain("not a Draco Slides file");
  });

  it("refuses files from a newer version instead of guessing", () => {
    const newerDoc = { ...createPresentation(), schemaVersion: 99 };
    expect(errorOf(wrap(newerDoc))).toContain("newer version");
    expect(errorOf(wrap(createPresentation(), { formatVersion: 2 }))).toContain("newer version");
  });

  it("migrates an older schema inside the envelope", () => {
    const v1 = {
      schemaVersion: 1,
      id: "old",
      title: "Old",
      width: 960,
      height: 540,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      slides: [{ id: "s", name: "S", objects: [{ id: "o", type: "text", role: "title", x: 0, y: 0, width: 5, height: 5, text: "T", fontSize: 30 }] }],
    };
    const r = deserializePresentation(wrap(v1));
    expect(r.ok && r.presentation.schemaVersion).toBe(3);
  });

  it("reports damaged content with the first problems", () => {
    const broken = { ...createPresentation(), slides: [] };
    expect(errorOf(wrap(broken))).toMatch(/damaged or invalid: .*at least one slide/);
  });

  it("drops unknown fields and trims over-long text", () => {
    const p = createPresentation("T");
    const dirty = JSON.parse(JSON.stringify(p));
    dirty.evil = "x";
    dirty.title = "t".repeat(500);
    dirty.slides[0].junk = [1, 2, 3];
    dirty.slides[0].objects[0].__proto__x = 1;
    dirty.slides[0].objects[0].extra = { deep: true };
    const r = deserializePresentation(wrap(dirty));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presentation).not.toHaveProperty("evil");
    expect(r.presentation.title).toHaveLength(200);
    expect(r.presentation.slides[0]).not.toHaveProperty("junk");
    expect(r.presentation.slides[0].objects[0]).not.toHaveProperty("extra");
  });

  it("rejects oversized files and absurd slide or object counts", () => {
    expect(errorOf("x".repeat(MAX_FILE_BYTES + 1))).toContain("too large");
    const base = createPresentation();
    const manySlides = { ...base, slides: Array.from({ length: MAX_SLIDES + 1 }, (_, i) => ({ id: `s${i}`, name: "s", objects: [] })) };
    expect(validatePresentation(manySlides).ok).toBe(false);
    const manyObjects = {
      ...base,
      slides: [{ id: "s", name: "s", objects: Array.from({ length: MAX_OBJECTS_PER_SLIDE + 1 }, (_, i) => ({ ...base.slides[0].objects[0], id: `o${i}` })) }],
    };
    expect(validatePresentation(manyObjects).ok).toBe(false);
  });
});

describe("fileNameFor", () => {
  it("builds a safe file name", () => {
    expect(fileNameFor("Q4 plan")).toBe(`Q4 plan${FILE_EXTENSION}`);
    expect(fileNameFor('a/b\\c:d*e?"f<g>h|i')).toBe(`a-b-c-d-e--f-g-h-i${FILE_EXTENSION}`);
    expect(fileNameFor("   ")).toBe(`presentation${FILE_EXTENSION}`);
    expect(fileNameFor("..hidden")).toBe(`hidden${FILE_EXTENSION}`);
    expect(fileNameFor("CON")).toBe(`_CON${FILE_EXTENSION}`);
    expect(fileNameFor("x".repeat(200))).toHaveLength(80 + FILE_EXTENSION.length);
  });
});

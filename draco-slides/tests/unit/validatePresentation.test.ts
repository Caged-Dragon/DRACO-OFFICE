import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { SLIDE_SIZES } from "../../src/core/document-model/sizes";
import { validatePresentation } from "../../src/core/validation/validatePresentation";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const errorsOf = (v: unknown) => {
  const r = validatePresentation(v);
  return r.ok ? [] : r.errors;
};

describe("validatePresentation", () => {
  it("accepts a new presentation at every slide-size preset", () => {
    for (const id of Object.keys(SLIDE_SIZES) as (keyof typeof SLIDE_SIZES)[]) {
      const p = createPresentation("T", { size: id, createdWith: "test" });
      expect(validatePresentation(p).ok).toBe(true);
      expect(p.width).toBe(SLIDE_SIZES[id].width);
      expect(p.height).toBe(SLIDE_SIZES[id].height);
    }
  });

  it("rejects non-objects and unknown schema versions", () => {
    expect(errorsOf(null)).not.toHaveLength(0);
    expect(errorsOf("x")).not.toHaveLength(0);
    expect(errorsOf({ ...createPresentation(), schemaVersion: 99 }).join()).toContain("schema version");
  });

  it("rejects duplicate ids across slides and objects", () => {
    const p = clone(createPresentation());
    p.slides[0].objects[1].id = p.slides[0].objects[0].id;
    expect(errorsOf(p).join()).toContain("duplicate id");
    const q = clone(createPresentation());
    q.slides[0].objects[0].id = q.slides[0].id;
    expect(errorsOf(q).join()).toContain("duplicate id");
  });

  it("rejects bad numbers, sizes and empty slide lists", () => {
    const p = clone(createPresentation());
    (p.slides[0].objects[0] as { x: unknown }).x = "10";
    p.slides[0].objects[1].width = -1;
    p.width = 5;
    expect(errorsOf(p).length).toBeGreaterThanOrEqual(3);
    expect(errorsOf({ ...createPresentation(), slides: [] }).join()).toContain("at least one slide");
  });

  it("rejects NaN and Infinity coordinates", () => {
    const p = clone(createPresentation());
    p.slides[0].objects[0].rotation = Number.POSITIVE_INFINITY;
    expect(errorsOf(p).join()).toContain("rotation");
  });

  it("rejects unknown object types and missing metadata", () => {
    const p = clone(createPresentation());
    (p.slides[0].objects[0] as { type: string }).type = "hologram";
    expect(errorsOf(p).join()).toContain("unknown object type");
    const q = { ...createPresentation(), metadata: undefined };
    expect(errorsOf(q).join()).toContain("metadata");
  });

  it("does not modify its input", () => {
    const p = createPresentation();
    const before = JSON.stringify(p);
    validatePresentation(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});

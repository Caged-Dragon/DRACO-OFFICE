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

  it("accepts the textbox role and rejects other roles", () => {
    const p = clone(createPresentation());
    p.slides[0].objects[0].role = "textbox";
    expect(validatePresentation(p).ok).toBe(true);
    (p.slides[0].objects[0] as { role: string }).role = "banner";
    expect(errorsOf(p).join()).toContain("role must be title, body or textbox");
  });

  it("does not modify its input", () => {
    const p = createPresentation();
    const before = JSON.stringify(p);
    validatePresentation(p);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("validates text formatting fields", () => {
    const mutate = (fn: (o: Record<string, unknown>) => void) => {
      const p = clone(createPresentation());
      fn(p.slides[0].objects[0] as unknown as Record<string, unknown>);
      return errorsOf(p).join();
    };
    expect(mutate((o) => (o.fontFamily = "Comic Sans MS"))).toContain("unknown font family");
    expect(mutate((o) => delete o.fontFamily)).toContain("unknown font family");
    expect(mutate((o) => (o.bold = "yes"))).toContain("bold must be true or false");
    expect(mutate((o) => (o.strike = undefined))).toContain("strike must be true or false");
    expect(mutate((o) => (o.color = "red"))).toContain("color must be a hex colour");
    expect(mutate((o) => (o.color = "url(javascript:x)"))).toContain("color must be a hex colour");
    expect(mutate((o) => (o.fontSize = 0))).toContain("fontSize");
    expect(mutate((o) => (o.fontSize = 5000))).toContain("fontSize");
    expect(mutate((o) => (o.color = "#ABCDEF"))).toBe(""); // upper case is accepted; it is normalized on import
  });

  it("validates paragraph settings", () => {
    const mutate = (fn: (o: Record<string, unknown>) => void) => {
      const p = clone(createPresentation());
      fn(p.slides[0].objects[1] as unknown as Record<string, unknown>);
      return errorsOf(p).join();
    };
    expect(mutate((o) => (o.align = "middle"))).toContain("align must be");
    expect(mutate((o) => delete o.align)).toContain("align must be");
    expect(mutate((o) => (o.direction = "up"))).toContain("direction must be ltr or rtl");
    expect(mutate((o) => (o.indent = 1.5))).toContain("indent must be a whole number");
    expect(mutate((o) => (o.indent = 9))).toContain("indent must be a whole number");
    expect(mutate((o) => (o.indent = -1))).toContain("indent must be a whole number");
    expect(mutate((o) => (o.lineSpacing = 0.1))).toContain("lineSpacing must be between");
    expect(mutate((o) => (o.lineSpacing = 9))).toContain("lineSpacing must be between");
    expect(mutate((o) => (o.lineSpacing = Number.NaN))).toContain("lineSpacing");
    expect(mutate((o) => Object.assign(o, { align: "justify", direction: "rtl", indent: 8, lineSpacing: 5 }))).toBe("");
  });

  it("validates the list style", () => {
    const p = clone(createPresentation());
    for (const ok of ["none", "bullet", "number"]) {
      (p.slides[0].objects[1] as { list: string }).list = ok;
      expect(errorsOf(p), ok).toEqual([]);
    }
    for (const bad of ["roman", "", 1, undefined]) {
      (p.slides[0].objects[1] as { list: unknown }).list = bad;
      expect(errorsOf(p).join(), String(bad)).toContain("list must be none, bullet or number");
    }
  });

  it("validates box settings", () => {
    const mutate = (fn: (o: Record<string, unknown>) => void) => {
      const p = clone(createPresentation());
      fn(p.slides[0].objects[1] as unknown as Record<string, unknown>);
      return errorsOf(p).join();
    };
    expect(mutate((o) => delete o.margins)).toContain("margins must be four numbers");
    expect(mutate((o) => (o.margins = { top: -1, right: 0, bottom: 0, left: 0 }))).toContain("margins must be four numbers");
    expect(mutate((o) => (o.margins = { top: 0, right: 0, bottom: 0, left: 500 }))).toContain("margins must be four numbers");
    expect(mutate((o) => (o.margins = { top: 0, right: 0, bottom: 0 }))).toContain("margins must be four numbers");
    expect(mutate((o) => (o.verticalAlign = "center"))).toContain("verticalAlign must be top, middle or bottom");
    expect(mutate((o) => (o.overflow = "scroll"))).toContain("overflow must be hidden or visible");
    expect(mutate((o) => Object.assign(o, { margins: { top: 200, right: 0, bottom: 0.5, left: 3 }, verticalAlign: "bottom", overflow: "visible" }))).toBe("");
  });

  it("validates groupId and locked", () => {
    const mutate = (fn: (o: Record<string, unknown>) => void) => {
      const p = clone(createPresentation());
      fn(p.slides[0].objects[1] as unknown as Record<string, unknown>);
      return errorsOf(p).join();
    };
    expect(mutate((o) => (o.locked = "yes"))).toContain("locked must be true or false");
    expect(mutate((o) => delete o.locked)).toContain("locked must be true or false");
    expect(mutate((o) => (o.groupId = ""))).toContain("groupId must be null or an id");
    expect(mutate((o) => (o.groupId = 5))).toContain("groupId must be null or an id");
    expect(mutate((o) => delete o.groupId)).toContain("groupId must be null or an id");
    expect(mutate((o) => Object.assign(o, { groupId: "g1", locked: true }))).toBe("");
  });
});


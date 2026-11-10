import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { parsePresentation } from "../../src/core/serialization/migrate";

const v1 = () => ({
  schemaVersion: 1,
  id: "p1",
  title: "Legacy",
  width: 960,
  height: 540,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  slides: [
    {
      id: "s1",
      name: "Slide 1",
      objects: [
        { id: "o1", type: "text", role: "title", x: 0, y: 0, width: 10, height: 10, text: "A", fontSize: 40 },
        { id: "o2", type: "text", role: "body", x: 0, y: 20, width: 10, height: 10, text: "B", fontSize: 20 },
      ],
    },
  ],
});

describe("parsePresentation", () => {
  it("upgrades schema 1 to the current schema with defaults and keeps content", () => {
    const r = parsePresentation(v1());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.title).toBe("Legacy");
    expect(r.value.metadata).toEqual({ author: "", description: "", language: "en", createdWith: "before 0.5.0" });
    expect(r.value.slides[0].objects.map((o) => o.name)).toEqual(["Title", "Body"]);
    expect(r.value.slides[0].objects[0].text).toBe("A");
  });

  it("upgrades schema 2 to the current schema, keeping content and adding default formatting", () => {
    const base = createPresentation("Two");
    const v2 = {
      ...base,
      schemaVersion: 2,
      slides: base.slides.map((sl) => ({
        ...sl,
        objects: sl.objects.map((o) => {
          const { fontFamily: _f, bold: _b, italic: _i, underline: _u, strike: _s, color: _c, ...legacy } = o;
          return legacy;
        }),
      })),
    };
    const r = parsePresentation(v2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides.map((sl) => sl.objects.map((o) => o.text))).toEqual(base.slides.map((sl) => sl.objects.map((o) => o.text)));
    expect(r.value.slides[0].objects[0]).toMatchObject({ role: "title", bold: true, fontFamily: "Segoe UI", color: "#1d1d1d", fontSize: 44 });
    expect(r.value.slides[0].objects[1]).toMatchObject({ role: "body", bold: false, italic: false, underline: false, strike: false });
    expect(v2.schemaVersion).toBe(2); // input untouched
  });

  it("upgrades schema 3 to 4 without overwriting formatting that is already there", () => {
    const base = createPresentation("Three");
    base.slides[0].objects[1].italic = true;
    base.slides[0].objects[1].color = "#ff0000";
    const r = parsePresentation({ ...base, schemaVersion: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides[0].objects[1]).toMatchObject({ italic: true, color: "#ff0000" });
  });

  it("upgrades schema 4 to 5 with default paragraph settings, keeping existing ones", () => {
    const base = createPresentation("Four");
    const v4 = JSON.parse(JSON.stringify(base));
    v4.schemaVersion = 4;
    for (const o of v4.slides[0].objects as Record<string, unknown>[]) {
      delete o.align;
      delete o.indent;
      delete o.lineSpacing;
      delete o.direction;
    }
    v4.slides[0].objects[0].align = "center"; // already set: must be kept
    const r = parsePresentation(v4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides[0].objects[0]).toMatchObject({ align: "center", indent: 0, lineSpacing: 1.2, direction: "ltr" });
    expect(r.value.slides[0].objects[1]).toMatchObject({ align: "left", indent: 0, lineSpacing: 1.2, direction: "ltr" });
  });

  it("upgrades schema 8 to 9 so existing objects are plain rectangles, keeping any shape settings already present", () => {
    const base = JSON.parse(JSON.stringify(createPresentation("Eight")));
    base.schemaVersion = 8;
    for (const o of base.slides[0].objects as Record<string, unknown>[]) {
      delete o.shape;
      delete o.fill;
      delete o.stroke;
      delete o.strokeWidth;
      delete o.flipV;
    }
    base.slides[0].objects[1].fill = "#ff0000";
    const r = parsePresentation(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides[0].objects[0]).toMatchObject({ shape: "rectangle", fill: null, stroke: null, strokeWidth: 2, flipV: false });
    expect(r.value.slides[0].objects[1]).toMatchObject({ shape: "rectangle", fill: "#ff0000" });
  });

  it("upgrades schema 7 to 8 with nothing grouped or locked, keeping existing values", () => {
    const base = JSON.parse(JSON.stringify(createPresentation("Seven")));
    base.schemaVersion = 7;
    for (const o of base.slides[0].objects as Record<string, unknown>[]) {
      delete o.groupId;
      delete o.locked;
    }
    base.slides[0].objects[1].locked = true;
    const r = parsePresentation(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides[0].objects[0]).toMatchObject({ groupId: null, locked: false });
    expect(r.value.slides[0].objects[1]).toMatchObject({ groupId: null, locked: true });
  });

  it("upgrades schema 6 to 7 with the box settings text was drawn with, keeping existing ones", () => {
    const base = JSON.parse(JSON.stringify(createPresentation("Six")));
    base.schemaVersion = 6;
    for (const o of base.slides[0].objects as Record<string, unknown>[]) {
      delete o.margins;
      delete o.verticalAlign;
      delete o.overflow;
    }
    base.slides[0].objects[1].verticalAlign = "middle";
    base.slides[0].objects[1].margins = { top: 5, right: 6, bottom: 7, left: 8 };
    const r = parsePresentation(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides[0].objects[0]).toMatchObject({ margins: { top: 0, right: 0, bottom: 0, left: 0 }, verticalAlign: "top", overflow: "hidden" });
    expect(r.value.slides[0].objects[1]).toMatchObject({ margins: { top: 5, right: 6, bottom: 7, left: 8 }, verticalAlign: "middle", overflow: "hidden" });
  });

  it("upgrades schema 5 to 6 with no list, keeping an existing list setting", () => {
    const base = JSON.parse(JSON.stringify(createPresentation("Five")));
    base.schemaVersion = 5;
    for (const o of base.slides[0].objects as Record<string, unknown>[]) delete o.list;
    base.slides[0].objects[1].list = "bullet";
    const r = parsePresentation(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(9);
    expect(r.value.slides[0].objects[0].list).toBe("none");
    expect(r.value.slides[0].objects[1].list).toBe("bullet");
  });

  it("does not mutate the stored record", () => {
    const raw = v1();
    const before = JSON.stringify(raw);
    parsePresentation(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("passes a current-schema document through unchanged", () => {
    const p = createPresentation("Now");
    const r = parsePresentation(p);
    expect(r.ok && r.value).toEqual(p);
  });

  it("rejects future or unknown schema versions instead of guessing", () => {
    expect(parsePresentation({ ...createPresentation(), schemaVersion: 10 }).ok).toBe(false);
    expect(parsePresentation({ schemaVersion: 0 }).ok).toBe(false);
  });

  it("rejects a corrupt v1 record after migration", () => {
    const bad = { ...v1(), slides: [] };
    expect(parsePresentation(bad).ok).toBe(false);
  });

  it("rejects garbage", () => {
    expect(parsePresentation(undefined).ok).toBe(false);
    expect(parsePresentation(42).ok).toBe(false);
  });
});

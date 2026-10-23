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
    expect(r.value.schemaVersion).toBe(3);
    expect(r.value.title).toBe("Legacy");
    expect(r.value.metadata).toEqual({ author: "", description: "", language: "en", createdWith: "before 0.5.0" });
    expect(r.value.slides[0].objects.map((o) => o.name)).toEqual(["Title", "Body"]);
    expect(r.value.slides[0].objects[0].text).toBe("A");
  });

  it("upgrades schema 2 to 3 without changing content", () => {
    const v2 = { ...createPresentation("Two"), schemaVersion: 2 };
    const r = parsePresentation(v2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schemaVersion).toBe(3);
    expect(r.value.slides).toEqual(v2.slides);
    expect(v2.schemaVersion).toBe(2); // input untouched
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
    expect(parsePresentation({ ...createPresentation(), schemaVersion: 4 }).ok).toBe(false);
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

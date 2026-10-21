import { describe, expect, it } from "vitest";
import type { Presentation } from "../../src/core/document-model/types";
import { createPresentation } from "../../src/core/document-model/factory";
import {
  deletePresentation,
  getPresentation,
  listPresentations,
  savePresentation,
} from "../../src/services/storage/presentationStore";

describe("presentationStore (IndexedDB)", () => {
  it("saves, lists, loads and deletes", async () => {
    const p = createPresentation("Round trip");
    await savePresentation(p);
    expect((await listPresentations()).some((x) => x.id === p.id)).toBe(true);
    expect((await getPresentation(p.id))?.title).toBe("Round trip");
    await deletePresentation(p.id);
    expect(await getPresentation(p.id)).toBeNull();
  });

  it("upgrades a schema-1 record on read and skips invalid records", async () => {
    const v1 = {
      schemaVersion: 1,
      id: "legacy-1",
      title: "Old deck",
      width: 960,
      height: 540,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
      slides: [
        {
          id: "s1",
          name: "Slide 1",
          objects: [{ id: "o1", type: "text", role: "title", x: 1, y: 2, width: 3, height: 4, text: "Hi", fontSize: 40 }],
        },
      ],
    };
    await savePresentation(v1 as unknown as Presentation);
    await savePresentation({ id: "broken-1", schemaVersion: 2 } as unknown as Presentation);
    const loaded = await getPresentation("legacy-1");
    expect(loaded?.schemaVersion).toBe(2);
    expect(loaded?.metadata.language).toBe("en");
    expect(loaded?.slides[0].objects[0]).toMatchObject({ name: "Title", rotation: 0, visible: true });
    expect(await getPresentation("broken-1")).toBeNull();
    expect((await listPresentations()).some((p) => p.id === "broken-1")).toBe(false);
    await deletePresentation("legacy-1");
    await deletePresentation("broken-1");
  });
});

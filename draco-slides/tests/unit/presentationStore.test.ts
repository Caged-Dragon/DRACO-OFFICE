import { describe, expect, it } from "vitest";
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
});

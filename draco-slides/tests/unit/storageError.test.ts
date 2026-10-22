import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareImport } from "../../src/services/import/importPresentation";
import { requestPersistentStorage } from "../../src/services/storage/persistence";
import {
  StorageError,
  classifyStorageError,
  describeStorageError,
  toStorageError,
} from "../../src/services/storage/storageError";
import { createPresentation } from "../../src/core/document-model/factory";

describe("storage errors", () => {
  it("classifies browser error names", () => {
    expect(classifyStorageError({ name: "QuotaExceededError" })).toBe("quota");
    expect(classifyStorageError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe("quota");
    expect(classifyStorageError({ name: "SecurityError" })).toBe("unavailable");
    expect(classifyStorageError({ name: "InvalidStateError" })).toBe("unavailable");
    expect(classifyStorageError(new Error("boom"))).toBe("unknown");
    expect(classifyStorageError(null)).toBe("unknown");
  });

  it("wraps and describes errors", () => {
    const e = toStorageError({ name: "QuotaExceededError" });
    expect(e).toBeInstanceOf(StorageError);
    expect(e.kind).toBe("quota");
    expect(toStorageError(e)).toBe(e);
    expect(describeStorageError(e)).toBe("Browser storage is full.");
    expect(describeStorageError(new StorageError("unavailable", "x"))).toContain("blocking local storage");
    expect(describeStorageError(new Error("x"))).toContain("unexpected");
  });
});

describe("prepareImport", () => {
  it("keeps the id when free and makes a separate copy when taken", () => {
    const p = createPresentation("Deck");
    expect(prepareImport(p, false)).toBe(p);
    const copy = prepareImport(p, true);
    expect(copy.id).not.toBe(p.id);
    expect(copy.title).toBe("Deck (imported)");
    expect(copy.slides).toEqual(p.slides);
  });
});

describe("requestPersistentStorage", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "storage");
    vi.restoreAllMocks();
  });
  const stub = (storage: unknown) =>
    Object.defineProperty(navigator, "storage", { value: storage, configurable: true });

  it("returns false when the API is missing or throws", async () => {
    expect(await requestPersistentStorage()).toBe(false);
    stub({ persist: vi.fn().mockRejectedValue(new Error("no")) });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("does not ask again when already persistent, and asks when not", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stub({ persist, persisted: vi.fn().mockResolvedValue(true) });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
    stub({ persist, persisted: vi.fn().mockResolvedValue(false) });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

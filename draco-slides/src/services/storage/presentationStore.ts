import { parsePresentation } from "../../core/serialization/migrate";
import type { Presentation } from "../../core/document-model/types";

const DB_NAME = "draco-slides";
const STORE = "presentations";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open local storage"));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Local storage request failed"));
    });
  } finally {
    db.close();
  }
}

export async function savePresentation(p: Presentation): Promise<void> {
  await run("readwrite", (s) => s.put(p));
}

export async function getPresentation(id: string): Promise<Presentation | null> {
  const value = await run<unknown>("readonly", (s) => s.get(id));
  const result = parsePresentation(value);
  return result.ok ? result.value : null;
}

/** Recent presentations, newest first. Older schemas are upgraded on read; invalid records are skipped, never deleted. */
export async function listPresentations(): Promise<Presentation[]> {
  const all = await run<unknown[]>("readonly", (s) => s.getAll());
  return all
    .flatMap((raw) => {
      const r = parsePresentation(raw);
      return r.ok ? [r.value] : [];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deletePresentation(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

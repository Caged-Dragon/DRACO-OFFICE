import { parsePresentation } from "../../core/serialization/migrate";
import type { Presentation } from "../../core/document-model/types";
import { StorageError, toStorageError } from "./storageError";

const DB_NAME = "draco-slides";
const STORE = "presentations";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new StorageError("unavailable", "IndexedDB is not available"));
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(toStorageError(req.error));
    } catch (e) {
      reject(toStorageError(e));
    }
  });
}

/** Resolves only when the transaction has committed, so a late quota failure is not reported as success. */
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, mode);
        let result: T;
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(toStorageError(tx.error ?? req.error));
        tx.onabort = () => reject(toStorageError(tx.error ?? req.error));
      } catch (e) {
        reject(toStorageError(e));
      }
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

/** True if any record, readable or not, uses this id. Used so imports never overwrite unreadable data. */
export async function recordExists(id: string): Promise<boolean> {
  return (await run<number>("readonly", (s) => s.count(IDBKeyRange.only(id)))) > 0;
}

export interface PresentationList {
  presentations: Presentation[];
  /** Stored records that failed validation. They are kept untouched, never deleted. */
  unreadable: number;
}

/** Recent presentations, newest first. Older schemas are upgraded on read. */
export async function listPresentationsDetailed(): Promise<PresentationList> {
  const all = await run<unknown[]>("readonly", (s) => s.getAll());
  const presentations: Presentation[] = [];
  let unreadable = 0;
  for (const raw of all) {
    const r = parsePresentation(raw);
    if (r.ok) presentations.push(r.value);
    else unreadable++;
  }
  presentations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { presentations, unreadable };
}

export async function listPresentations(): Promise<Presentation[]> {
  return (await listPresentationsDetailed()).presentations;
}

export async function deletePresentation(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

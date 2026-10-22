/**
 * Asks the browser not to evict our IndexedDB data under storage pressure. Best effort:
 * browsers may decline, and the answer is not shown to the user.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!storage?.persist) return false;
    if (storage.persisted && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

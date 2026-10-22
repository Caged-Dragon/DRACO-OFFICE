export type StorageErrorKind = "quota" | "unavailable" | "unknown";

export class StorageError extends Error {
  readonly kind: StorageErrorKind;
  constructor(kind: StorageErrorKind, message: string) {
    super(message);
    this.name = "StorageError";
    this.kind = kind;
  }
}

export function classifyStorageError(e: unknown): StorageErrorKind {
  const name = typeof e === "object" && e !== null ? (e as { name?: unknown }).name : undefined;
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return "quota";
  if (name === "SecurityError" || name === "InvalidStateError" || name === "UnknownError" || name === "NotAllowedError") {
    return "unavailable";
  }
  return "unknown";
}

export function toStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  return new StorageError(classifyStorageError(e), e instanceof Error ? e.message : "Storage request failed");
}

/** Short, user-facing explanation. */
export function describeStorageError(e: unknown): string {
  const kind = e instanceof StorageError ? e.kind : classifyStorageError(e);
  switch (kind) {
    case "quota":
      return "Browser storage is full.";
    case "unavailable":
      return "This browser is blocking local storage (private browsing?).";
    default:
      return "An unexpected storage error occurred.";
  }
}

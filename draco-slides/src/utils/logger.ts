/** Single place for reporting unexpected errors, so telemetry can be added later without touching callers. */
export function logError(context: string, error: unknown, detail?: string): void {
  console.error(`[draco-slides] ${context}`, error, detail ?? "");
}

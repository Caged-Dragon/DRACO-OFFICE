import { useEffect } from "react";
import { logError } from "../utils/logger";

const THROTTLE_MS = 5000;

/** Reports uncaught errors and unhandled promise rejections to the user (at most once per 5 s) and to the log. */
export function useGlobalErrorHandlers(notify: (kind: "info" | "error", message: string) => void): void {
  useEffect(() => {
    let last = 0;
    const report = (context: string, error: unknown) => {
      logError(context, error);
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      notify("error", "Something unexpected went wrong. If anything looks wrong, use File > Save a copy to file to keep your work.");
    };
    const onError = (e: ErrorEvent) => {
      // Harmless browser notice that is not a real failure.
      if (typeof e.message === "string" && e.message.includes("ResizeObserver loop")) return;
      report("window error", e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => report("unhandled rejection", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [notify]);
}

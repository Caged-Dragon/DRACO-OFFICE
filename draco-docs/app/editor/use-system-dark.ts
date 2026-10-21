"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Tracks the OS dark-mode setting live (so "System" follows the OS if it
 * changes while the editor is open). useSyncExternalStore is the supported
 * way to read an external value like this without effect + setState.
 */
export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false // server render: assume light
  );
}

import type { Point } from "../../core/geometry/viewport";

export interface PointerStore {
  get: () => Point | null;
  set: (p: Point | null) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Tiny store for the pointer position in slide coordinates. Values are rounded and only
 * published when they change, so just the status-bar readout re-renders while the mouse moves.
 */
export function createPointerStore(): PointerStore {
  let value: Point | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (p) => {
      const next = p ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
      if (next === null ? value === null : value !== null && next.x === value.x && next.y === value.y) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

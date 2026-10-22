import { describe, expect, it, vi } from "vitest";
import { createPointerStore } from "../../src/features/canvas/pointerStore";

describe("pointerStore", () => {
  it("rounds values and only notifies on change", () => {
    const store = createPointerStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set({ x: 10.4, y: 20.6 });
    expect(store.get()).toEqual({ x: 10, y: 21 });
    store.set({ x: 10.2, y: 20.9 }); // rounds to the same point
    expect(listener).toHaveBeenCalledTimes(1);
    store.set(null);
    store.set(null);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    store.set({ x: 1, y: 1 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

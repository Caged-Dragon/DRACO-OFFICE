import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  parseSettings,
  resolveTheme,
  saveSettings,
} from "../../src/services/settings/settingsStore";

describe("settings store", () => {
  it("falls back to defaults for missing or junk data", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1])).toEqual(DEFAULT_SETTINGS);
  });

  it("repairs each field independently", () => {
    const s = parseSettings({ theme: "neon", defaultSlideSize: "4:3", defaultAuthor: 5, showSlidePane: false, showTextPanel: "yes" });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, defaultSlideSize: "4:3", showSlidePane: false });
  });

  it("trims and caps the author name", () => {
    expect(parseSettings({ defaultAuthor: "  Ana  " }).defaultAuthor).toBe("Ana");
    expect(parseSettings({ defaultAuthor: "x".repeat(500) }).defaultAuthor).toHaveLength(200);
  });

  it("loads, saves and survives bad stored text", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const next = { ...DEFAULT_SETTINGS, theme: "light" as const, defaultAuthor: "Ana" };
    expect(saveSettings(next, storage)).toBe(true);
    expect(JSON.parse(store.get(SETTINGS_KEY) ?? "{}")).toEqual(next);
    expect(loadSettings(storage)).toEqual(next);
    store.set(SETTINGS_KEY, "{not json");
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it("reports a failed save and tolerates missing storage", () => {
    const full = { setItem: vi.fn(() => { throw new Error("quota"); }) };
    expect(saveSettings(DEFAULT_SETTINGS, full)).toBe(false);
    expect(saveSettings(DEFAULT_SETTINGS, null)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("resolves the theme", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
});

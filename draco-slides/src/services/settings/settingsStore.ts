import { DEFAULT_SLIDE_SIZE, SLIDE_SIZE_IDS, type SlideSizeId } from "../../core/document-model/sizes";

export type ThemeSetting = "system" | "dark" | "light";

export interface Settings {
  theme: ThemeSetting;
  defaultSlideSize: SlideSizeId;
  defaultAuthor: string;
  showSlidePane: boolean;
  showTextPanel: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  defaultSlideSize: DEFAULT_SLIDE_SIZE,
  defaultAuthor: "",
  showSlidePane: true,
  showTextPanel: true,
};

export const SETTINGS_KEY = "draco-slides:settings";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Accepts anything; every field falls back to its default independently, so one bad value never loses the rest. */
export function parseSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    theme: r.theme === "dark" || r.theme === "light" || r.theme === "system" ? r.theme : d.theme,
    defaultSlideSize: SLIDE_SIZE_IDS.includes(r.defaultSlideSize as SlideSizeId)
      ? (r.defaultSlideSize as SlideSizeId)
      : d.defaultSlideSize,
    defaultAuthor: typeof r.defaultAuthor === "string" ? r.defaultAuthor.trim().slice(0, 200) : d.defaultAuthor,
    showSlidePane: typeof r.showSlidePane === "boolean" ? r.showSlidePane : d.showSlidePane,
    showTextPanel: typeof r.showTextPanel === "boolean" ? r.showTextPanel : d.showTextPanel,
  };
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage: Pick<Storage, "getItem"> | null = browserStorage()): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return parseSettings(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Returns false when the settings could not be stored (blocked or full storage). */
export function saveSettings(settings: Settings, storage: Pick<Storage, "setItem"> | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(theme: ThemeSetting, prefersLight: boolean): "dark" | "light" {
  return theme === "system" ? (prefersLight ? "light" : "dark") : theme;
}

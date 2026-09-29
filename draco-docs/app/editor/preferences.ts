import type { ResolvedTheme } from "./style-sets";

/**
 * Per-user viewing preferences. Deliberately NOT part of the document
 * (.dwdoc) — opening a colleague's file must not change how your editor
 * looks, and your theme choice shouldn't travel with a file you share.
 */
export type PageThemePreference = "light" | "dark" | "system";

export type Preferences = {
  pageTheme: PageThemePreference;
};

export const DEFAULT_PREFERENCES: Preferences = { pageTheme: "system" };

const PREFERENCES_KEY = "docwrite:preferences";
const THEME_VALUES: readonly PageThemePreference[] = ["light", "dark", "system"];

export function sanitizePreferences(input: unknown): Preferences {
  const partial =
    input && typeof input === "object" ? (input as Partial<Preferences>) : {};
  return {
    pageTheme: THEME_VALUES.includes(partial.pageTheme as PageThemePreference)
      ? (partial.pageTheme as PageThemePreference)
      : DEFAULT_PREFERENCES.pageTheme,
  };
}

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — the preference just won't persist.
  }
}

/** "system" resolves to whatever the OS currently prefers. */
export function resolveTheme(
  pref: PageThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (pref === "system") return systemPrefersDark ? "dark" : "light";
  return pref;
}

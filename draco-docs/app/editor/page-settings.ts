import { DEFAULT_STYLE_SET_ID, isStyleSetId, type StyleSetId } from "./style-sets";

export type PageSize = "A4" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";
export type MarginPreset = "normal" | "narrow" | "moderate" | "wide";

export type PageSettings = {
  size: PageSize;
  orientation: Orientation;
  margin: MarginPreset;
  styleSet: StyleSetId;
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: "Letter",
  orientation: "portrait",
  margin: "normal",
  styleSet: DEFAULT_STYLE_SET_ID,
};

/**
 * Merge untrusted/partial settings (old localStorage entries, .dwdoc files
 * from earlier versions, hand-edited files) over the defaults, and make sure
 * the style set is one that actually exists.
 */
export function sanitizePageSettings(input: unknown): PageSettings {
  const partial =
    input && typeof input === "object" ? (input as Partial<PageSettings>) : {};
  const d = DEFAULT_PAGE_SETTINGS;
  // Every field is validated against its allowed values, so a stale or
  // hand-edited value can never reach the layout code (which indexes into
  // lookup tables and would throw on an unknown key).
  return {
    size: (["A4", "Letter", "Legal"] as const).includes(partial.size as PageSize)
      ? (partial.size as PageSize)
      : d.size,
    orientation: (["portrait", "landscape"] as const).includes(
      partial.orientation as Orientation
    )
      ? (partial.orientation as Orientation)
      : d.orientation,
    margin: (["narrow", "normal", "moderate", "wide"] as const).includes(
      partial.margin as MarginPreset
    )
      ? (partial.margin as MarginPreset)
      : d.margin,
    styleSet: isStyleSetId(partial.styleSet) ? partial.styleSet : d.styleSet,
  };
}

// Base dimensions in inches, portrait orientation.
const PAGE_DIMENSIONS_IN: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 8.27, height: 11.69 },
  Letter: { width: 8.5, height: 11 },
  Legal: { width: 8.5, height: 14 },
};

const MARGIN_IN: Record<MarginPreset, number> = {
  narrow: 0.5,
  normal: 1,
  moderate: 0.75,
  wide: 1.5,
};

export function getPageDimensionsIn(settings: PageSettings) {
  const base = PAGE_DIMENSIONS_IN[settings.size];
  const { width, height } =
    settings.orientation === "landscape"
      ? { width: base.height, height: base.width }
      : base;
  return { width, height };
}

export function getMarginIn(settings: PageSettings) {
  return MARGIN_IN[settings.margin];
}

const PAGE_SETTINGS_KEY = "docwrite:pageSettings";

export function loadPageSettings(): PageSettings {
  if (typeof window === "undefined") return DEFAULT_PAGE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(PAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_PAGE_SETTINGS;
    return sanitizePageSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_PAGE_SETTINGS;
  }
}

export function savePageSettings(settings: PageSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable — page settings just won't persist.
  }
}

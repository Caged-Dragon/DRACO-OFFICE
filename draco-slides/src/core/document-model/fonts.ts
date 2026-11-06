import type { TextFormat } from "./types";

export const DEFAULT_FONT_FAMILY = "Segoe UI";
export const DEFAULT_TEXT_COLOR = "#1d1d1d";
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 400;

/**
 * Fonts a presentation may use. The stored value is the name; the CSS stack adds fallbacks for systems that
 * lack the font. A fixed list keeps files portable and means a file can never inject arbitrary CSS.
 */
export const FONT_FAMILIES = [
  { name: "Segoe UI", css: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif' },
  { name: "Arial", css: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  { name: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { name: "Trebuchet MS", css: '"Trebuchet MS", "Lucida Grande", sans-serif' },
  { name: "Georgia", css: 'Georgia, "Times New Roman", serif' },
  { name: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { name: "Courier New", css: '"Courier New", Courier, monospace' },
  { name: "Consolas", css: 'Consolas, Menlo, "Courier New", monospace' },
] as const;

export const FONT_FAMILY_NAMES: readonly string[] = FONT_FAMILIES.map((f) => f.name);

export function cssFontFamily(name: string): string {
  return (FONT_FAMILIES.find((f) => f.name === name) ?? FONT_FAMILIES[0]).css;
}

export const FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 120, 144, 200, 300, 400] as const;

/** Next size up (dir 1) or down (dir -1) from `size`, stopping at the limits. */
export function nextFontSize(size: number, dir: 1 | -1): number {
  if (dir === 1) return FONT_SIZE_STEPS.find((s) => s > size) ?? MAX_FONT_SIZE;
  return [...FONT_SIZE_STEPS].reverse().find((s) => s < size) ?? MIN_FONT_SIZE;
}

/** "#rgb" or "#rrggbb" in any case -> lowercase "#rrggbb"; anything else -> null. */
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

/** Defaults per text role: titles are bold and larger. */
export function defaultTextFormat(role: "title" | "body" | "textbox"): TextFormat {
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: role === "title" ? 44 : 24,
    bold: role === "title",
    italic: false,
    underline: false,
    strike: false,
    color: DEFAULT_TEXT_COLOR,
  };
}

/** Keeps only valid fields of a requested format change, clamped and normalized. Unknown or invalid values are dropped. */
export function sanitizeTextFormatPatch(patch: Partial<Record<keyof TextFormat, unknown>>): Partial<TextFormat> {
  const out: Partial<TextFormat> = {};
  if (typeof patch.fontFamily === "string" && FONT_FAMILY_NAMES.includes(patch.fontFamily)) out.fontFamily = patch.fontFamily;
  if (typeof patch.fontSize === "number" && Number.isFinite(patch.fontSize)) {
    out.fontSize = Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, patch.fontSize)) * 2) / 2;
  }
  for (const key of ["bold", "italic", "underline", "strike"] as const) {
    if (typeof patch[key] === "boolean") out[key] = patch[key];
  }
  const color = normalizeColor(patch.color);
  if (color) out.color = color;
  return out;
}

/** Builds a one-field format change with a precise type (avoids computed-key typing pitfalls). */
export function formatPatch(key: keyof TextFormat, value: unknown): Partial<Record<keyof TextFormat, unknown>> {
  const patch: Partial<Record<keyof TextFormat, unknown>> = {};
  patch[key] = value;
  return patch;
}

import type { Alignment, Direction, ListStyle, ParagraphFormat } from "./types";

export const ALIGNMENTS: readonly Alignment[] = ["left", "center", "right", "justify"];
export const DIRECTIONS: readonly Direction[] = ["ltr", "rtl"];
export const LIST_STYLES: readonly ListStyle[] = ["none", "bullet", "number"];
export const MAX_INDENT_LEVEL = 8;
/** Slide pixels per indent level. */
export const INDENT_STEP = 36;
export const MIN_LINE_SPACING = 0.5;
export const MAX_LINE_SPACING = 5;
export const DEFAULT_LINE_SPACING = 1.2;
export const LINE_SPACING_PRESETS = [1, 1.2, 1.5, 2, 2.5, 3] as const;

export const defaultParagraphFormat = (): ParagraphFormat => ({
  align: "left",
  indent: 0,
  lineSpacing: DEFAULT_LINE_SPACING,
  direction: "ltr",
  list: "none",
});

/** Keeps only valid fields of a requested paragraph change; indent is a whole level, spacing has two decimals. */
export function sanitizeParagraphPatch(patch: Partial<Record<keyof ParagraphFormat, unknown>>): Partial<ParagraphFormat> {
  const out: Partial<ParagraphFormat> = {};
  if (ALIGNMENTS.includes(patch.align as Alignment)) out.align = patch.align as Alignment;
  if (DIRECTIONS.includes(patch.direction as Direction)) out.direction = patch.direction as Direction;
  if (LIST_STYLES.includes(patch.list as ListStyle)) out.list = patch.list as ListStyle;
  if (typeof patch.indent === "number" && Number.isFinite(patch.indent)) {
    out.indent = Math.min(MAX_INDENT_LEVEL, Math.max(0, Math.round(patch.indent)));
  }
  if (typeof patch.lineSpacing === "number" && Number.isFinite(patch.lineSpacing)) {
    out.lineSpacing = Math.round(Math.min(MAX_LINE_SPACING, Math.max(MIN_LINE_SPACING, patch.lineSpacing)) * 100) / 100;
  }
  return out;
}

/**
 * Applies a change to the current paragraph settings. Switching direction also mirrors a left or right
 * alignment (right-to-left text starts on the right), unless the same change sets the alignment explicitly.
 */
export function applyParagraphPatch(current: ParagraphFormat, patch: Partial<ParagraphFormat>): ParagraphFormat {
  const next: ParagraphFormat = { ...current, ...patch };
  if (patch.direction && patch.direction !== current.direction && patch.align === undefined) {
    if (next.align === "left" || next.align === "right") next.align = patch.direction === "rtl" ? "right" : "left";
  }
  return next;
}

export const paragraphEqual = (a: ParagraphFormat, b: ParagraphFormat): boolean =>
  a.align === b.align && a.indent === b.indent && a.lineSpacing === b.lineSpacing && a.direction === b.direction && a.list === b.list;

/** One-field patch with a precise type. */
export function paragraphPatch(key: keyof ParagraphFormat, value: unknown): Partial<Record<keyof ParagraphFormat, unknown>> {
  const patch: Partial<Record<keyof ParagraphFormat, unknown>> = {};
  patch[key] = value;
  return patch;
}

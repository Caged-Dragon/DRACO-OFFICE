import type { BoxFormat, Margins, OverflowMode, VerticalAlign } from "./types";

export const VERTICAL_ALIGNS: readonly VerticalAlign[] = ["top", "middle", "bottom"];
export const OVERFLOW_MODES: readonly OverflowMode[] = ["hidden", "visible"];
export const MAX_MARGIN = 200;

/** No margins, text at the top, overflow clipped: how text objects were drawn before margins existed. */
export const defaultBoxFormat = (): BoxFormat => ({
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  verticalAlign: "top",
  overflow: "hidden",
});

/** A requested change; every field is optional and untrusted until sanitized. */
export interface BoxPatch {
  margins?: Partial<Record<keyof Margins, unknown>>;
  verticalAlign?: unknown;
  overflow?: unknown;
}
export interface CleanBoxPatch {
  margins?: Partial<Margins>;
  verticalAlign?: VerticalAlign;
  overflow?: OverflowMode;
}

/** Keeps only valid fields. Margins are clamped to 0..200 and rounded to half a pixel. */
export function sanitizeBoxPatch(patch: BoxPatch): CleanBoxPatch {
  const out: CleanBoxPatch = {};
  if (VERTICAL_ALIGNS.includes(patch.verticalAlign as VerticalAlign)) out.verticalAlign = patch.verticalAlign as VerticalAlign;
  if (OVERFLOW_MODES.includes(patch.overflow as OverflowMode)) out.overflow = patch.overflow as OverflowMode;
  if (patch.margins && typeof patch.margins === "object") {
    const margins: Partial<Margins> = {};
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const v = patch.margins[side];
      if (typeof v === "number" && Number.isFinite(v)) margins[side] = Math.round(Math.min(MAX_MARGIN, Math.max(0, v)) * 2) / 2;
    }
    if (Object.keys(margins).length > 0) out.margins = margins;
  }
  return out;
}

export function applyBoxPatch(current: BoxFormat, patch: CleanBoxPatch): BoxFormat {
  return {
    margins: { ...current.margins, ...patch.margins },
    verticalAlign: patch.verticalAlign ?? current.verticalAlign,
    overflow: patch.overflow ?? current.overflow,
  };
}

export const boxEqual = (a: BoxFormat, b: BoxFormat): boolean =>
  a.verticalAlign === b.verticalAlign &&
  a.overflow === b.overflow &&
  a.margins.top === b.margins.top &&
  a.margins.right === b.margins.right &&
  a.margins.bottom === b.margins.bottom &&
  a.margins.left === b.margins.left;

export const isValidMargins = (m: unknown): m is Margins =>
  typeof m === "object" &&
  m !== null &&
  (["top", "right", "bottom", "left"] as const).every((k) => {
    const v = (m as Record<string, unknown>)[k];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_MARGIN;
  });

/** One-margin change with a precise type. */
export function marginPatch(side: keyof Margins, value: number): BoxPatch {
  const margins: Partial<Record<keyof Margins, unknown>> = {};
  margins[side] = value;
  return { margins };
}

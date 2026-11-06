import { MIN_FONT_SIZE } from "../../core/document-model/fonts";
import { largestFittingSize } from "../../core/geometry/fit";

/** Browsers round layout; ignore differences up to this many pixels. */
const TOLERANCE = 1;

/** True when the element has been laid out on screen. Without layout (hidden, or a test environment) nothing can be measured. */
export const hasLayout = (el: HTMLElement): boolean => el.clientWidth > 0 && el.clientHeight > 0;

/** True when the text is taller or wider than its box. */
export function textOverflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + TOLERANCE || el.scrollWidth > el.clientWidth + TOLERANCE;
}

/** Runs `measure` with some inline styles temporarily replaced, then puts the originals back. */
function withTemporaryStyle<T>(el: HTMLElement, temp: Record<string, string>, measure: () => T): T {
  const style = el.style as unknown as Record<string, string>;
  const saved = Object.fromEntries(Object.keys(temp).map((k) => [k, style[k]]));
  Object.assign(style, temp);
  try {
    return measure();
  } finally {
    Object.assign(style, saved);
  }
}

/**
 * Largest font size, at most `current`, at which the element's text fits its box (width and height).
 * Returns null when the element has no layout. `fits` is false when even the smallest size overflows.
 * Text is measured top-aligned so that vertical centring cannot hide overflow above the box.
 */
export function fitFontSize(el: HTMLElement, current: number): { size: number; fits: boolean } | null {
  if (!hasLayout(el)) return null;
  return withTemporaryStyle(el, { justifyContent: "flex-start" }, () =>
    largestFittingSize(
      (size) => {
        el.style.fontSize = `${size}px`;
        return !textOverflows(el);
      },
      MIN_FONT_SIZE,
      current,
    ),
  );
}

/** Height that exactly holds the text (including the box's margins), or null when the element has no layout. */
export function fitBoxHeight(el: HTMLElement): number | null {
  if (!hasLayout(el)) return null;
  return withTemporaryStyle(el, { height: "auto", justifyContent: "flex-start" }, () => Math.ceil(el.offsetHeight));
}

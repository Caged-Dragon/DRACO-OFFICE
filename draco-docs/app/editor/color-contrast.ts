/**
 * WCAG relative luminance / contrast ratio. Used only for the live
 * background-color warning in the UI — NOT a substitute for
 * scripts/check-a11y-contrast.mjs, which verifies the app's own fixed
 * design tokens. This exists because backgroundColor is arbitrary
 * user-picked color, which a static checker can't exhaustively verify.
 */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort(
    (a, b) => b - a
  );
  return (l1 + 0.05) / (l2 + 0.05);
}

export const WCAG_AA_NORMAL_TEXT = 4.5;

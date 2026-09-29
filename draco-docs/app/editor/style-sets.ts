export type StyleSetId = "default" | "classic" | "modern" | "formal" | "minimal";

export type StyleSet = {
  id: StyleSetId;
  name: string;
  description: string;
  headingFont: string;
  bodyFont: string;
  headingColor: string;
  bodyColor: string;
  /** Text colors used when the page theme is dark. */
  dark: { headingColor: string; bodyColor: string };
  lineHeight: string;
};

export type ResolvedTheme = "light" | "dark";

/**
 * Non-text-color tokens per page theme. Chosen (and checked by
 * `npm run check:contrast`) so text on the page background meets WCAG AA.
 */
export const THEME_TOKENS: Record<
  ResolvedTheme,
  { pageBg: string; muted: string; border: string; thBg: string; link: string }
> = {
  light: {
    pageBg: "#ffffff",
    muted: "#475569",
    border: "#cbd5e1",
    thBg: "#f1f5f9",
    link: "#1d4ed8",
  },
  dark: {
    pageBg: "#1e293b",
    muted: "#a8b5c8",
    border: "#475569",
    thBg: "#334155",
    link: "#93c5fd",
  },
};

// System font stacks only — no web fonts, no external font requests.
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

export const STYLE_SETS: StyleSet[] = [
  {
    id: "default",
    name: "Default",
    description: "Clean sans-serif, neutral colors.",
    headingFont: SANS,
    bodyFont: SANS,
    headingColor: "#0f172a",
    bodyColor: "#1e293b",
    dark: { headingColor: "#f8fafc", bodyColor: "#e2e8f0" },
    lineHeight: "1.6",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Serif throughout, like a printed book.",
    headingFont: SERIF,
    bodyFont: SERIF,
    headingColor: "#1c1917",
    bodyColor: "#292524",
    dark: { headingColor: "#fafaf9", bodyColor: "#e7e5e4" },
    lineHeight: "1.7",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Sans-serif with blue headings.",
    headingFont: SANS,
    bodyFont: SANS,
    headingColor: "#1d4ed8",
    bodyColor: "#334155",
    dark: { headingColor: "#93c5fd", bodyColor: "#cbd5e1" },
    lineHeight: "1.65",
  },
  {
    id: "formal",
    name: "Formal",
    description: "Serif headings over a sans-serif body.",
    headingFont: SERIF,
    bodyFont: SANS,
    headingColor: "#111827",
    bodyColor: "#374151",
    dark: { headingColor: "#f3f4f6", bodyColor: "#d1d5db" },
    lineHeight: "1.5",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Monospace, high contrast, tight spacing.",
    headingFont: MONO,
    bodyFont: MONO,
    headingColor: "#000000",
    bodyColor: "#171717",
    dark: { headingColor: "#ffffff", bodyColor: "#f5f5f5" },
    lineHeight: "1.5",
  },
];

export const DEFAULT_STYLE_SET_ID: StyleSetId = "default";

/**
 * Resolve any value (including a missing, stale, or hand-edited one read
 * from localStorage or a .dwdoc file) to a real style set, falling back to
 * the default rather than ever returning undefined.
 */
export function getStyleSet(id: unknown): StyleSet {
  return (
    STYLE_SETS.find((s) => s.id === id) ??
    STYLE_SETS.find((s) => s.id === DEFAULT_STYLE_SET_ID)!
  );
}

export function isStyleSetId(value: unknown): value is StyleSetId {
  return STYLE_SETS.some((s) => s.id === value);
}

export function styleSetToCssVars(
  id: unknown,
  theme: ResolvedTheme = "light"
): Record<string, string> {
  const set = getStyleSet(id);
  const t = THEME_TOKENS[theme];
  const colors = theme === "dark" ? set.dark : set;
  return {
    "--doc-heading-font": set.headingFont,
    "--doc-body-font": set.bodyFont,
    "--doc-heading-color": colors.headingColor,
    "--doc-body-color": colors.bodyColor,
    "--doc-line-height": set.lineHeight,
    "--doc-page-bg": t.pageBg,
    "--doc-muted": t.muted,
    "--doc-border": t.border,
    "--doc-th-bg": t.thBg,
    "--doc-link": t.link,
  };
}

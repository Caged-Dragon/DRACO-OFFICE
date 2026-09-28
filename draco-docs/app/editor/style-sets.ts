export type StyleSetId = "default" | "classic" | "modern" | "formal" | "minimal";

export type StyleSet = {
  id: StyleSetId;
  name: string;
  description: string;
  headingFont: string;
  bodyFont: string;
  headingColor: string;
  bodyColor: string;
  lineHeight: string;
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

export function styleSetToCssVars(id: unknown): Record<string, string> {
  const set = getStyleSet(id);
  return {
    "--doc-heading-font": set.headingFont,
    "--doc-body-font": set.bodyFont,
    "--doc-heading-color": set.headingColor,
    "--doc-body-color": set.bodyColor,
    "--doc-line-height": set.lineHeight,
  };
}

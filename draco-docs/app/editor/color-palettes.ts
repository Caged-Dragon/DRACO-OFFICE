import type { ResolvedTheme } from "./style-sets";

export type NamedColor = { name: string; value: string };

/**
 * Text-color choices, one palette per page theme. Every color here must
 * reach 4.5:1 contrast against its theme's page background — enforced by
 * `npm run check:contrast`. Names are used as accessible labels, so a screen
 * reader says "Red" rather than "#f87171".
 *
 * "Automatic" is intentionally not in these lists: it clears the color so
 * the text follows the style set and theme (see FontControls).
 */
export const TEXT_PALETTES: Record<ResolvedTheme, NamedColor[]> = {
  light: [
    { name: "Red", value: "#b91c1c" },
    { name: "Orange", value: "#c2410c" },
    { name: "Amber", value: "#a16207" },
    { name: "Green", value: "#15803d" },
    { name: "Blue", value: "#1d4ed8" },
    { name: "Purple", value: "#7e22ce" },
  ],
  dark: [
    { name: "Red", value: "#fca5a5" },
    { name: "Orange", value: "#fdba74" },
    { name: "Amber", value: "#fde047" },
    { name: "Green", value: "#86efac" },
    { name: "Blue", value: "#93c5fd" },
    { name: "Purple", value: "#d8b4fe" },
  ],
};

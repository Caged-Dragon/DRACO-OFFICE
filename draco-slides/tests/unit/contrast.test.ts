import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, relativeLuminance } from "../../src/utils/contrast";

describe("contrast helpers", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 9);
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5); // the classic AA boundary grey
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 9);
    expect(hexToRgb("#1a2b3c")).toEqual([26, 43, 60]);
    expect(() => hexToRgb("blue")).toThrow();
  });
});

const css = readFileSync(fileURLToPath(new URL("../../src/styles/global.css", import.meta.url)), "utf-8");
const vars = (block: string) =>
  Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1], m[2]]));
const dark = vars(/:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "");
const lightOverrides = vars(/:root\[data-theme="light"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "");
const themes = { dark, light: { ...dark, ...lightOverrides } };

// Text/background pairs that the stylesheet actually uses. WCAG AA for normal text is 4.5:1.
const PAIRS: [string, string][] = [
  ["text", "ink"],
  ["text", "panel"],
  ["text", "stage"],
  ["text", "ribbon"],
  ["text", "pressed"],
  ["muted", "ink"],
  ["muted", "panel"],
  ["muted", "stage"],
  ["muted", "ribbon"],
  ["ember", "ink"],
  ["err", "ink"],
  ["err", "panel"],
  ["on-ember", "btn-primary"],
  ["on-ember-dark", "btn-primary-hover"],
];

describe("theme colors", () => {
  it("both themes define the same set of tokens", () => {
    expect(Object.keys(lightOverrides).sort()).toEqual(
      Object.keys(lightOverrides).filter((k) => k in dark).sort(),
    );
    for (const k of PAIRS.flat()) {
      expect(themes.dark[k], `dark --${k}`).toBeDefined();
      expect(themes.light[k], `light --${k}`).toBeDefined();
    }
  });

  for (const [name, t] of Object.entries(themes)) {
    for (const [fg, bg] of PAIRS) {
      it(`${name}: ${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
        expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

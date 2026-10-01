#!/usr/bin/env node
/**
 * Accessibility guardrails — run with `npm run check:contrast`.
 *
 * Loads the app's real color data (style-sets.ts, color-palettes.ts) using the
 * project's own TypeScript, so there are no duplicated numbers to drift, then:
 *   1. checks WCAG AA (4.5:1) for every style set x theme, and every palette
 *   2. checks the toolbar-chrome text/background pairs the UI is allowed to use
 *   3. scans source for classes known to fail contrast, and for form controls
 *      with no accessible name
 *
 * No dependencies beyond what the project already has.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const AA = 4.5;

// ---------- WCAG math ----------
function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- load real TS modules ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docwrite-a11y-"));
async function loadTs(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = path.join(tmp, path.basename(rel).replace(/\.ts$/, ".mjs"));
  fs.writeFileSync(out, js);
  return import(pathToFileURL(out).href);
}
const { STYLE_SETS, THEME_TOKENS } = await loadTs("app/editor/style-sets.ts");
const { TEXT_PALETTES } = await loadTs("app/editor/color-palettes.ts");

let failures = 0;
let passes = 0;
function expect(label, fg, bg, min = AA) {
  const r = contrast(fg, bg);
  if (r >= min) passes++;
  else {
    failures++;
    console.error(`FAIL  ${label}: ${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
  }
}
function assert(cond, msg) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`FAIL  ${msg}`);
  }
}

// ---------- 1. document colors ----------
for (const theme of ["light", "dark"]) {
  const t = THEME_TOKENS[theme];
  for (const set of STYLE_SETS) {
    const c = theme === "dark" ? set.dark : set;
    const tag = `${set.id}/${theme}`;
    expect(`${tag} body text`, c.bodyColor, t.pageBg);
    expect(`${tag} heading text`, c.headingColor, t.pageBg);
    expect(`${tag} heading on table header`, c.headingColor, t.thBg);
    expect(`${tag} body on table header`, c.bodyColor, t.thBg);
    expect(`${tag} body on comment highlight`, c.bodyColor, t.commentBg);
    expect(`${tag} body on resolved-comment highlight`, c.bodyColor, t.commentResolvedBg);
  }
  expect(`${theme} muted text`, t.muted, t.pageBg);
  expect(`${theme} link`, t.link, t.pageBg);
  for (const { name, value } of TEXT_PALETTES[theme]) {
    expect(`${theme} palette "${name}"`, value, t.pageBg);
  }
  // Highlight marks force this text color regardless of theme (see globals.css).
  for (const hl of ["#facc15", "#4ade80", "#60a5fa", "#f472b6"]) {
    expect(`highlight ${hl} with forced dark text`, "#0f172a", hl);
  }
}

// ---------- 2. toolbar chrome (Tailwind slate scale) ----------
const slate = {
  200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8",
  800: "#1e293b", 900: "#0f172a", 950: "#020617",
};
for (const fg of [200, 300, 400])
  for (const bg of [800, 900, 950])
    expect(`chrome text-slate-${fg} on slate-${bg}`, slate[fg], slate[bg]);
expect("chrome placeholder color on slate-900", "#94a3b8", slate[900]);
expect("white on blue-600 (active buttons)", "#ffffff", "#2563eb");

// ---------- 3. source scans ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(path.join(root, "app"));

const BANNED = [
  [/\btext-slate-(500|600|700)\b/, "text-slate-500/600/700 fails AA on the dark toolbar (use text-slate-400 or a --doc-* variable on the page)"],
  [/\bplaceholder-slate-[4-6]00\b/, "placeholder-slate-* utilities fail AA; placeholder colors are set globally"],
  [/\btext-\[(9|10)px\]/, "9-10px text is too small to read comfortably; use text-xs"],
];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(root, f);
  for (const [re, why] of BANNED) {
    const m = src.match(re);
    if (m) {
      failures++;
      const line = src.slice(0, m.index).split("\n").length;
      console.error(`FAIL  ${rel}:${line}  ${m[0]}  -> ${why}`);
    } else passes++;
  }
}

// Form controls must have an accessible name.
function extractTags(src, name) {
  const tags = [];
  let i = 0;
  const open = `<${name}`;
  while ((i = src.indexOf(open, i)) !== -1) {
    const next = src[i + open.length];
    if (next && /[A-Za-z0-9]/.test(next)) { i += open.length; continue; }
    let depth = 0, quote = null, j = i + open.length;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (quote) { if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0 && src[j - 1] !== "=") break;
    }
    tags.push({ text: src.slice(i, j + 1), index: i });
    i = j + 1;
  }
  return tags;
}
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(root, f);
  for (const name of ["input", "select", "textarea"]) {
    for (const { text, index } of extractTags(src, name)) {
      if (/type=["']hidden["']/.test(text)) continue;
      const named = /aria-label(ledby)?=/.test(text);
      const before = src.slice(0, index);
      const insideLabel = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
      const line = before.split("\n").length;
      assert(named || insideLabel, `${rel}:${line} <${name}> has no accessible name (add aria-label or wrap in <label>)`);
    }
  }
}

// Removing focus outlines is only OK if a global :focus-visible rule replaces them.
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const usesOutlineNone = files.some((f) => /focus:outline-none/.test(fs.readFileSync(f, "utf8")));
if (usesOutlineNone)
  assert(/:focus-visible[^{]*\{[^}]*outline:[^}]*!important/.test(css),
    "focus:outline-none is used but globals.css has no !important :focus-visible replacement");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0
  ? `Accessibility checks passed (${passes} checks).`
  : `\n${failures} accessibility check(s) FAILED (${passes} passed).`);
process.exit(failures ? 1 : 0);

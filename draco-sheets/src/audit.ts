// Formula auditing (v43/v44): reference extraction, precedents/dependents, error scan.
// Pure functions (no engine imports) so they can be unit-tested in Node.

export interface Rect { sheet: string | null; r1: number; c1: number; r2: number; c2: number }
export interface FormulaCell { sheet: string; row: number; col: number; formula: string }

export const colToNum = (s: string) => s.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const numToCol = (n: number) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export const a1 = (row: number, col: number) => numToCol(col) + (row + 1);

const CELL = String.raw`\$?([A-Za-z]{1,3})\$?(\d{1,7})`;
const SHEET = String.raw`(?:'((?:[^']|'')+)'|([A-Za-z_一-龥][\w.一-龥]*))!`;
const REF_RE = new RegExp(String.raw`(?<![\w.$!'])(?:${SHEET})?${CELL}(?::${CELL})?(?![\w(!])`, 'g');
const NAME_RE = /(?<![\w.$!'"])([A-Za-z_\\][\w.]*)(?![\w.(!'])/g;

/** Remove string literals so "A1" inside text is not treated as a reference. */
export const stripStrings = (f: string) => f.replace(/"(?:[^"]|"")*"/g, '""');

export function extractRefs(formula: string, homeSheet: string): Rect[] {
  const out: Rect[] = [];
  const src = stripStrings(formula);
  for (const m of src.matchAll(REF_RE)) {
    const sheet = (m[1] ? m[1].replace(/''/g, "'") : m[2]) ?? homeSheet;
    const c1 = colToNum(m[3]), r1 = Number(m[4]) - 1;
    const c2 = m[5] ? colToNum(m[5]) : c1, r2 = m[6] ? Number(m[6]) - 1 : r1;
    if (c1 > 16383 || c2 > 16383) continue;
    out.push({ sheet, r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) });
  }
  return out;
}

/** Resolve defined names used in a formula to rectangles (names map: NAME -> "Sheet1!$B$1:$B$5"). */
export function extractNameRefs(formula: string, homeSheet: string, names: Record<string, string>): Rect[] {
  const out: Rect[] = [];
  const lower = Object.fromEntries(Object.entries(names).map(([k, v]) => [k.toLowerCase(), v]));
  for (const m of stripStrings(formula).matchAll(NAME_RE)) {
    const target = lower[m[1].toLowerCase()];
    if (target) out.push(...extractRefs(target, homeSheet));
  }
  return out;
}

export const rectHas = (r: Rect, sheet: string, row: number, col: number) =>
  r.sheet === sheet && row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2;

export const rectLabel = (r: Rect, home?: string) => {
  const a = a1(r.r1, r.c1), b = a1(r.r2, r.c2);
  const body = a === b ? a : `${a}:${b}`;
  return r.sheet && r.sheet !== home ? `${/[^\w]/.test(r.sheet) ? `'${r.sheet}'` : r.sheet}!${body}` : body;
};

export interface Node { sheet: string; row: number; col: number; label: string; level: number; isFormula: boolean }

/** Direct (level 1) or transitive precedents of a cell. Ranges are reported as ranges, not expanded. */
export function precedents(cell: { sheet: string; row: number; col: number }, formulas: FormulaCell[], names: Record<string, string>, deep: boolean, limit = 300): Rect[] {
  const bySheetCell = new Map(formulas.map((f) => [`${f.sheet}|${f.row}|${f.col}`, f]));
  const seen = new Set<string>(); const out: Rect[] = [];
  let frontier = [bySheetCell.get(`${cell.sheet}|${cell.row}|${cell.col}`)].filter(Boolean) as FormulaCell[];
  while (frontier.length && out.length < limit) {
    const next: FormulaCell[] = [];
    for (const f of frontier) {
      for (const r of [...extractRefs(f.formula, f.sheet), ...extractNameRefs(f.formula, f.sheet, names)]) {
        const key = `${r.sheet}|${r.r1}|${r.c1}|${r.r2}|${r.c2}`;
        if (seen.has(key)) continue;
        seen.add(key); out.push(r);
        if (deep) for (const g of formulas) if (rectHas(r, g.sheet, g.row, g.col)) next.push(g);
      }
    }
    if (!deep) break;
    frontier = next;
  }
  return out;
}

/** Cells whose formulas reference `cell` (directly, or transitively when deep). */
export function dependents(cell: { sheet: string; row: number; col: number }, formulas: FormulaCell[], names: Record<string, string>, deep: boolean, limit = 300): FormulaCell[] {
  const refs = formulas.map((f) => ({ f, rects: [...extractRefs(f.formula, f.sheet), ...extractNameRefs(f.formula, f.sheet, names)] }));
  const out: FormulaCell[] = []; const seen = new Set<string>();
  let frontier = [cell];
  while (frontier.length && out.length < limit) {
    const next: FormulaCell[] = [];
    for (const t of frontier) {
      for (const { f, rects } of refs) {
        const key = `${f.sheet}|${f.row}|${f.col}`;
        if (seen.has(key) || (f.sheet === cell.sheet && f.row === cell.row && f.col === cell.col)) continue;
        if (rects.some((r) => rectHas(r, t.sheet, t.row, t.col))) { seen.add(key); out.push(f); next.push(f); }
      }
    }
    if (!deep) break;
    frontier = next;
  }
  return out;
}

export const ERROR_RE = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|SPILL!|CALC!|GETTING_DATA)$/;
export const isErrorValue = (v: unknown) => typeof v === 'string' && ERROR_RE.test(v);

/** Cells that take part in a circular reference (Tarjan SCC; a self-reference counts). Skips sheets with > maxCells formulas. */
export function findCircular(formulas: FormulaCell[], names: Record<string, string>, maxCells = 5000): { cells: FormulaCell[]; skipped: boolean } {
  if (formulas.length > maxCells) return { cells: [], skipped: true };
  const key = (f: FormulaCell) => `${f.sheet}|${f.row}|${f.col}`;
  const idx = new Map(formulas.map((f, i) => [key(f), i]));
  const bySheet = new Map<string, number[]>();
  formulas.forEach((f, i) => bySheet.set(f.sheet, [...(bySheet.get(f.sheet) ?? []), i]));
  const edges: number[][] = formulas.map((f) => {
    const out = new Set<number>();
    for (const r of [...extractRefs(f.formula, f.sheet), ...extractNameRefs(f.formula, f.sheet, names)])
      for (const j of bySheet.get(r.sheet ?? f.sheet) ?? []) if (rectHas(r, formulas[j].sheet, formulas[j].row, formulas[j].col)) out.add(j);
    return [...out];
  });
  // iterative Tarjan
  let counter = 0; const index = new Array(formulas.length).fill(-1), low = new Array(formulas.length).fill(0), on = new Array(formulas.length).fill(false);
  const stack: number[] = []; const cyc = new Set<number>();
  for (let s = 0; s < formulas.length; s++) {
    if (index[s] !== -1) continue;
    const work: Array<[number, number]> = [[s, 0]];
    while (work.length) {
      const [v, i] = work[work.length - 1];
      if (i === 0 && index[v] === -1) { index[v] = low[v] = counter++; stack.push(v); on[v] = true; }
      if (i < edges[v].length) {
        work[work.length - 1][1]++;
        const w = edges[v][i];
        if (index[w] === -1) work.push([w, 0]);
        else if (on[w]) low[v] = Math.min(low[v], index[w]);
      } else {
        if (low[v] === index[v]) {
          const comp: number[] = []; let w: number;
          do { w = stack.pop()!; on[w] = false; comp.push(w); } while (w !== v);
          if (comp.length > 1 || edges[v].includes(v)) comp.forEach((c) => cyc.add(c));
        }
        work.pop();
        if (work.length) { const p = work[work.length - 1][0]; low[p] = Math.min(low[p], low[v]); }
      }
    }
  }
  void idx;
  return { cells: [...cyc].sort((a, b) => a - b).map((i) => formulas[i]), skipped: false };
}

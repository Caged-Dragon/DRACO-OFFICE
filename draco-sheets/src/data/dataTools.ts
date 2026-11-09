// Data tools that Excel has and the engine lacks (v48, v50, v53, v56-v60). Pure functions: no engine imports, unit-tested in Node.
import { a1 } from '../formulas/audit';
import { maxOf, minOf } from '../formulas/safeMath';

export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];
const isBlank = (v: Cell) => v === null || v === undefined || v === '';
const norm = (v: Cell, cs: boolean) => {
  const s = isBlank(v) ? '' : String(v);
  return cs ? s : s.toLowerCase();
};

/* ---------- v53 Remove Duplicates ---------- */
export interface DedupeResult {
  kept: Grid;
  removedRows: number[];
  removed: number;
}
/** Excel semantics: compares only chosen columns, case-insensitive by default, first occurrence wins, header row kept. */
export function removeDuplicates(
  rows: Grid,
  opts: { cols?: number[]; hasHeader?: boolean; caseSensitive?: boolean } = {},
): DedupeResult {
  const { hasHeader = true, caseSensitive = false } = opts;
  const width = maxOf(
    rows.map((r) => r.length),
    [0],
  );
  const cols = opts.cols && opts.cols.length ? opts.cols : Array.from({ length: width }, (_, i) => i);
  const seen = new Set<string>();
  const kept: Grid = [];
  const removedRows: number[] = [];
  rows.forEach((r, i) => {
    if (hasHeader && i === 0) {
      kept.push(r);
      return;
    }
    const key = JSON.stringify(cols.map((c) => norm(r[c], caseSensitive)));
    if (seen.has(key)) removedRows.push(i);
    else {
      seen.add(key);
      kept.push(r);
    }
  });
  return { kept, removedRows, removed: removedRows.length };
}

/* ---------- v53 Flash Fill (pattern synthesis from examples) ---------- */
type Xf = 'id' | 'upper' | 'lower' | 'proper' | 'initial';
type Piece =
  | { t: 'const'; s: string }
  | { t: 'tok'; i: number; fromEnd: boolean; xf: Xf }
  | { t: 'left'; n: number; xf: Xf }
  | { t: 'right'; n: number; xf: Xf }
  | { t: 'mid'; s: number; n: number; xf: Xf };
const XFS: Xf[] = ['id', 'proper', 'upper', 'lower', 'initial'];
const applyXf = (s: string, xf: Xf) =>
  xf === 'upper'
    ? s.toUpperCase()
    : xf === 'lower'
      ? s.toLowerCase()
      : xf === 'proper'
        ? s.replace(/\p{L}[\p{L}\p{N}']*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        : xf === 'initial'
          ? (s[0] ?? '').toUpperCase()
          : s;
const tokens = (s: string) => s.split(/[\s,.;:_\-@/\\()]+/).filter(Boolean);

function evalPiece(p: Piece, input: string): string | null {
  if (p.t === 'const') return p.s;
  if (p.t === 'left') return input.length >= p.n ? applyXf(input.slice(0, p.n), p.xf) : null;
  if (p.t === 'right') return input.length >= p.n ? applyXf(input.slice(-p.n), p.xf) : null;
  if (p.t === 'mid') return input.length >= p.s + p.n ? applyXf(input.slice(p.s, p.s + p.n), p.xf) : null;
  const t = tokens(input);
  const w = p.fromEnd ? t[t.length - 1 - p.i] : t[p.i];
  return w === undefined ? null : applyXf(w, p.xf);
}
const runProgram = (prog: Piece[], input: string): string | null => {
  let out = '';
  for (const p of prog) {
    const r = evalPiece(p, input);
    if (r === null) return null;
    out += r;
  }
  return out;
};

/** All programs (sequences of pieces) that map `input` to `output`, limited and ordered simplest-first. */
const pieceCost = (x: Piece) =>
  (x.t === 'const' ? 1 + x.s.length * 0.5 : x.t === 'tok' ? 0.5 : x.t === 'mid' ? 1.2 : 1) + 0.3;
/** k-best programs (cheapest first) mapping `input` to `output`. Cost is additive, so keeping the K cheapest per position is exact. */
function synth(input: string, output: string, K = 40): Piece[][] {
  const cands: Piece[] = [];
  const t = tokens(input);
  for (let i = 0; i < t.length; i++)
    for (const fromEnd of [false, true])
      for (const xf of XFS) cands.push({ t: 'tok', i: fromEnd ? t.length - 1 - i : i, fromEnd, xf });
  for (let n = 1; n <= Math.min(input.length, 12); n++)
    for (const xf of XFS) {
      cands.push({ t: 'left', n, xf });
      cands.push({ t: 'right', n, xf });
    }
  for (let st = 1; st < Math.min(input.length, 16); st++)
    for (let n = 1; n <= Math.min(input.length - st, 12); n++) cands.push({ t: 'mid', s: st, n, xf: 'id' });
  const memo = new Map<number, Array<{ prog: Piece[]; cost: number }>>();
  const go = (pos: number): Array<{ prog: Piece[]; cost: number }> => {
    if (pos === output.length) return [{ prog: [], cost: 0 }];
    const hit = memo.get(pos);
    if (hit) return hit;
    const res: Array<{ prog: Piece[]; cost: number }> = [];
    const extend = (c: Piece, s: string) => {
      for (const r of go(pos + s.length)) res.push({ prog: [c, ...r.prog], cost: pieceCost(c) + r.cost });
    };
    for (const c of cands) {
      const s = evalPiece(c, input);
      if (s && /[\p{L}\p{N}]/u.test(s) && output.startsWith(s, pos)) extend(c, s); // separators are always literals, never copied by position
    }
    for (let k = 1; k <= Math.min(3, output.length - pos); k++)
      extend({ t: 'const', s: output.slice(pos, pos + k) }, output.slice(pos, pos + k));
    res.sort((a, b) => a.cost - b.cost);
    const top = res.slice(0, K);
    memo.set(pos, top);
    return top;
  };
  return go(0).map((x) => x.prog);
}

export interface FlashResult {
  outputs: (string | null)[];
  confident: boolean;
  program?: string;
}
/** Learn from (input -> output) example pairs and fill the rest. */
export function flashFill(examples: Array<[string, string]>, inputs: string[]): FlashResult {
  if (!examples.length) return { outputs: inputs.map(() => null), confident: false };
  const [first, ...rest] = examples;
  const candidates = synth(first[0], first[1]);
  const prog = candidates.find((p) => rest.every(([i, o]) => runProgram(p, i) === o));
  if (!prog) return { outputs: inputs.map(() => null), confident: false };
  const describe = prog
    .map((p) =>
      p.t === 'const'
        ? JSON.stringify(p.s)
        : p.t === 'tok'
          ? `${p.xf === 'id' ? '' : p.xf + ' '}${p.fromEnd ? 'last-' : 'word '}${p.i}`
          : p.t === 'mid'
            ? `mid ${p.s}+${p.n}`
            : `${p.t} ${p.n}`,
    )
    .join(' + ');
  return { outputs: inputs.map((i) => runProgram(prog, i)), confident: true, program: describe };
}

/* ---------- v59 Goal Seek (async: each evaluation recalculates the sheet) ---------- */
export interface SeekResult {
  x: number;
  fx: number;
  iterations: number;
  converged: boolean;
}
export async function goalSeek(
  evaluate: (x: number) => Promise<number>,
  target: number,
  x0: number,
  opts: { tol?: number; maxIter?: number } = {},
): Promise<SeekResult> {
  const tol = opts.tol ?? 1e-6,
    maxIter = opts.maxIter ?? 80;
  const g = async (x: number) => (await evaluate(x)) - target;
  let a = x0,
    ga = await g(a);
  let n = 1;
  if (!Number.isFinite(ga)) return { x: a, fx: ga + target, iterations: n, converged: false };
  if (Math.abs(ga) <= tol) return { x: a, fx: ga + target, iterations: n, converged: true };
  // bracket: expand outward from x0
  let step = Math.max(1, Math.abs(x0) * 0.5),
    b = a,
    gb = ga,
    bracketed = false;
  for (let k = 0; k < 40 && !bracketed && n < maxIter; k++) {
    for (const dir of [1, -1]) {
      b = a + dir * step;
      gb = await g(b);
      n++;
      if (!Number.isFinite(gb)) continue;
      if (Math.abs(gb) <= tol) return { x: b, fx: gb + target, iterations: n, converged: true };
      if (Math.sign(gb) !== Math.sign(ga)) {
        bracketed = true;
        break;
      }
    }
    step *= 2;
  }
  if (!bracketed) return { x: a, fx: ga + target, iterations: n, converged: false };
  let lo = a,
    glo = ga,
    hi = b,
    ghi = gb;
  while (n < maxIter) {
    // regula falsi with bisection safeguard
    let m = hi - (ghi * (hi - lo)) / (ghi - glo);
    if (!Number.isFinite(m) || m <= Math.min(lo, hi) || m >= Math.max(lo, hi)) m = (lo + hi) / 2;
    const gm = await g(m);
    n++;
    if (!Number.isFinite(gm)) return { x: m, fx: gm + target, iterations: n, converged: false };
    if (Math.abs(gm) <= tol) return { x: m, fx: gm + target, iterations: n, converged: true };
    if (Math.sign(gm) === Math.sign(glo)) {
      lo = m;
      glo = gm;
    } else {
      hi = m;
      ghi = gm;
    }
    if (Math.abs(hi - lo) < 1e-12 * Math.max(1, Math.abs(m)))
      return { x: m, fx: gm + target, iterations: n, converged: Math.abs(gm) <= Math.max(tol, 1e-4) };
  }
  const x = (lo + hi) / 2;
  return { x, fx: await evaluate(x), iterations: n + 1, converged: false };
}

/* ---------- v59 Consolidate ---------- */
export type ConsFn = 'sum' | 'average' | 'count' | 'max' | 'min' | 'product';
const FN: Record<ConsFn, (v: number[]) => number> = {
  sum: (v) => v.reduce((a, b) => a + b, 0),
  average: (v) => v.reduce((a, b) => a + b, 0) / v.length,
  count: (v) => v.length,
  max: (v) => maxOf(v),
  min: (v) => minOf(v),
  product: (v) => v.reduce((a, b) => a * b, 1),
};
const num = (v: Cell): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null;
/** By position: cell i,j of every source combined. By labels: first column = row labels, first row = column labels (both kept in first-seen order). */
export function consolidate(sources: Grid[], fn: ConsFn, mode: 'position' | 'labels'): Grid {
  const f = FN[fn];
  if (mode === 'position') {
    const h = maxOf(sources.map((s) => s.length)),
      w = maxOf(
        sources.map((s) =>
          maxOf(
            s.map((r) => r.length),
            [0],
          ),
        ),
      );
    return Array.from({ length: h }, (_, i) =>
      Array.from({ length: w }, (_, j) => {
        const v = sources.map((s) => num(s[i]?.[j])).filter((x): x is number => x !== null);
        return v.length ? f(v) : null;
      }),
    );
  }
  const rowLabels: string[] = [],
    colLabels: string[] = [];
  for (const s of sources) {
    s.slice(1).forEach((r) => {
      const l = String(r[0] ?? '');
      if (l && !rowLabels.includes(l)) rowLabels.push(l);
    });
    (s[0] ?? []).slice(1).forEach((c) => {
      const l = String(c ?? '');
      if (l && !colLabels.includes(l)) colLabels.push(l);
    });
  }
  const out: Grid = [[sources[0]?.[0]?.[0] ?? null, ...colLabels]];
  for (const rl of rowLabels) {
    out.push([
      rl,
      ...colLabels.map((cl) => {
        const vals: number[] = [];
        for (const s of sources) {
          const ci = (s[0] ?? []).findIndex((c, k) => k > 0 && String(c ?? '') === cl);
          if (ci < 0) continue;
          for (const r of s.slice(1))
            if (String(r[0] ?? '') === rl) {
              const v = num(r[ci]);
              if (v !== null) vals.push(v);
            }
        }
        return vals.length ? f(vals) : null;
      }),
    ]);
  }
  return out;
}

/* ---------- v48 Advanced Filter (criteria range semantics) ---------- */
const wildToRe = (p: string) =>
  new RegExp(
    '^' +
      p
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/~\*/g, '\u0001')
        .replace(/~\?/g, '\u0002')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\u0001/g, '\\*')
        .replace(/\u0002/g, '\\?') +
      '$',
    'i',
  );
export function matchesCriterion(value: Cell, crit: Cell): boolean {
  if (isBlank(crit)) return true;
  const c = String(crit).trim();
  const m = c.match(/^(<=|>=|<>|<|>|=)(.*)$/);
  if (m) {
    const [, op, rhsRaw] = m;
    const rhs = rhsRaw.trim();
    if (rhs === '') return op === '=' ? isBlank(value) : op === '<>' ? !isBlank(value) : false;
    const nv = num(value),
      nr = num(rhs);
    if (nv !== null && nr !== null)
      return op === '='
        ? nv === nr
        : op === '<>'
          ? nv !== nr
          : op === '<'
            ? nv < nr
            : op === '>'
              ? nv > nr
              : op === '<='
                ? nv <= nr
                : nv >= nr;
    const sv = norm(value, false),
      sr = rhs.toLowerCase();
    if (op === '=') return wildToRe(rhs).test(String(value ?? ''));
    if (op === '<>') return !wildToRe(rhs).test(String(value ?? ''));
    return op === '<' ? sv < sr : op === '>' ? sv > sr : op === '<=' ? sv <= sr : sv >= sr;
  }
  const nv = num(value),
    nc = num(c);
  if (nc !== null && nv !== null) return nv === nc;
  return wildToRe(c.includes('*') || c.includes('?') ? c : c + '*').test(String(value ?? '')); // plain text = "begins with"
}
/** Row i matches if ANY criteria row matches; a criteria row matches if ALL its non-blank cells match (columns matched by header name). */
export function advancedFilter(
  data: Grid,
  criteria: Grid,
  opts: { uniqueOnly?: boolean } = {},
): { matches: number[]; rows: Grid } {
  const header = (data[0] ?? []).map((h) => String(h ?? '').toLowerCase());
  const critHead = (criteria[0] ?? []).map((h) => String(h ?? '').toLowerCase());
  const critRows = criteria.slice(1).filter((r) => r.some((c) => !isBlank(c)));
  const matches: number[] = [];
  const seen = new Set<string>();
  data.slice(1).forEach((row, k) => {
    const ok =
      critRows.length === 0 ||
      critRows.some((cr) =>
        critHead.every((h, ci) => {
          const di = header.indexOf(h);
          return isBlank(cr[ci]) || (di >= 0 && matchesCriterion(row[di], cr[ci]));
        }),
      );
    if (!ok) return;
    if (opts.uniqueOnly) {
      const key = JSON.stringify(row.map((v) => norm(v, false)));
      if (seen.has(key)) return;
      seen.add(key);
    }
    matches.push(k + 1);
  });
  return { matches, rows: [data[0], ...matches.map((i) => data[i])] };
}

/* ---------- v50 Go To Special ---------- */
export type SpecialKind =
  | 'blanks'
  | 'constants'
  | 'formulas'
  | 'numbers'
  | 'text'
  | 'logical'
  | 'errors'
  | 'formulaNumbers'
  | 'formulaText'
  | 'formulaErrors'
  | 'lastCell';
const ERR = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|SPILL!|CALC!)$/;
/** `values` and `formulas` are same-size grids over the area scanned (formulas[i][j] starts with "=" for formula cells). Returns [row, col] pairs (grid-relative). */
export function goToSpecial(values: Grid, formulas: Grid, kind: SpecialKind): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let lastR = -1,
    lastC = -1;
  values.forEach((row, i) =>
    row.forEach((v, j) => {
      const f = formulas[i]?.[j];
      const isF = typeof f === 'string' && f.startsWith('=');
      const blank = isBlank(v) && !isF;
      if (!blank) {
        lastR = Math.max(lastR, i);
        lastC = Math.max(lastC, j);
      }
      const isErr = typeof v === 'string' && ERR.test(v);
      const isNum = typeof v === 'number',
        isBool = typeof v === 'boolean';
      const isText = typeof v === 'string' && !isErr && !isBlank(v);
      const hit =
        kind === 'blanks'
          ? blank
          : kind === 'formulas'
            ? isF
            : kind === 'constants'
              ? !isF && !blank
              : kind === 'numbers'
                ? !isF && isNum
                : kind === 'text'
                  ? !isF && isText
                  : kind === 'logical'
                    ? !isF && isBool
                    : kind === 'errors'
                      ? isErr
                      : kind === 'formulaNumbers'
                        ? isF && isNum
                        : kind === 'formulaText'
                          ? isF && isText
                          : kind === 'formulaErrors'
                            ? isF && isErr
                            : false;
      if (hit) out.push([i, j]);
    }),
  );
  return kind === 'lastCell' ? (lastR >= 0 ? [[lastR, lastC]] : []) : out;
}
/** Collapse cell list into A1 ranges (row-wise runs) for selecting. */
export function toRanges(cells: Array<[number, number]>, r0 = 0, c0 = 0): string[] {
  const rows = new Map<number, number[]>();
  cells.forEach(([r, c]) => rows.set(r, [...(rows.get(r) ?? []), c]));
  const out: string[] = [];
  for (const [r, cs] of [...rows].sort((a, b) => a[0] - b[0])) {
    cs.sort((a, b) => a - b);
    let s = cs[0],
      p = cs[0];
    for (const c of [...cs.slice(1), Infinity]) {
      if (c !== p + 1) {
        out.push(s === p ? a1(r + r0, s + c0) : `${a1(r + r0, s + c0)}:${a1(r + r0, p + c0)}`);
        s = c;
      }
      p = c;
    }
  }
  return out;
}

/* ---------- v56 Subtotal ---------- */
export interface SubtotalOpts {
  groupCol: number;
  sumCols: number[];
  fn?: 9 | 1 | 2 | 4 | 5 | 6 | 101;
  label?: string;
}
const FN_NAME: Record<number, string> = { 9: 'Total', 1: 'Average', 2: 'Count', 4: 'Max', 5: 'Min', 6: 'Product' };
/** Insert subtotal rows after each group (data must already be sorted by the group column). First row = header. Returns the new grid; subtotal cells are SUBTOTAL formulas in A1 terms relative to `startRow` (0-based sheet row of the header). */
export function addSubtotals(
  data: Grid,
  startRow: number,
  startCol: number,
  o: SubtotalOpts,
): { grid: Grid; subtotalRows: number[] } {
  const fn = o.fn ?? 9;
  const name = FN_NAME[fn] ?? 'Total';
  const out: Grid = [data[0]];
  const subtotalRows: number[] = [];
  let groupStart = 1; // index into `out` where current group begins (after header)
  const body = data.slice(1);
  const col = (c: number) => a1(0, startCol + c).replace(/\d+/, '');
  const pushSub = (label: string, from: number, to: number) => {
    const row: Cell[] = data[0].map(() => null);
    row[o.groupCol] = label;
    for (const c of o.sumCols)
      row[c] = `=SUBTOTAL(${fn},${col(c)}${startRow + from + 1}:${col(c)}${startRow + to + 1})`;
    subtotalRows.push(out.length);
    out.push(row);
  };
  body.forEach((r, i) => {
    out.push(r);
    const next = body[i + 1];
    if (!next || norm(next[o.groupCol], false) !== norm(r[o.groupCol], false)) {
      pushSub(`${r[o.groupCol] ?? ''} ${o.label ?? name}`, groupStart, out.length - 1);
      groupStart = out.length;
    }
  });
  const gt = data[0].map((): Cell => null);
  gt[o.groupCol] = `Grand ${o.label ?? name}`;
  for (const c of o.sumCols) gt[c] = `=SUBTOTAL(${fn},${col(c)}${startRow + 2}:${col(c)}${startRow + out.length})`;
  subtotalRows.push(out.length);
  out.push(gt);
  return { grid: out, subtotalRows };
}
/** Remove subtotal/grand-total rows previously inserted (identified by SUBTOTAL formulas). */
export function removeSubtotals(formulas: Grid, values: Grid): number[] {
  return formulas
    .map((r, i) => (r.some((c) => typeof c === 'string' && /^=SUBTOTAL\(/i.test(c)) ? i : -1))
    .filter((i) => i > 0);
}

/* ---------- v57/v58 Table styles ---------- */
export interface TableStyle {
  name: string;
  header: { bg: string; fg: string };
  band1: string;
  band2: string;
  border: string;
}
export const TABLE_STYLES: TableStyle[] = [
  { name: 'Blue', header: { bg: '#4472C4', fg: '#FFFFFF' }, band1: '#D9E2F3', band2: '#FFFFFF', border: '#8EA9DB' },
  { name: 'Orange', header: { bg: '#ED7D31', fg: '#FFFFFF' }, band1: '#FBE5D6', band2: '#FFFFFF', border: '#F4B183' },
  { name: 'Green', header: { bg: '#70AD47', fg: '#FFFFFF' }, band1: '#E2EFDA', band2: '#FFFFFF', border: '#A9D08E' },
  { name: 'Gray', header: { bg: '#7F7F7F', fg: '#FFFFFF' }, band1: '#EDEDED', band2: '#FFFFFF', border: '#BFBFBF' },
  { name: 'Gold', header: { bg: '#BF9000', fg: '#FFFFFF' }, band1: '#FFF2CC', band2: '#FFFFFF', border: '#FFD966' },
  { name: 'Dark', header: { bg: '#262626', fg: '#FFFFFF' }, band1: '#D9D9D9', band2: '#F2F2F2', border: '#595959' },
];
/** Per-row fill/font plan for a table of `rows` rows (row 0 = header). */
export function tablePlan(
  rows: number,
  style: TableStyle,
  opts: { banded?: boolean; totalRow?: boolean } = {},
): Array<{ bg: string; fg?: string; bold?: boolean }> {
  const banded = opts.banded ?? true;
  return Array.from({ length: rows }, (_, i) =>
    i === 0
      ? { bg: style.header.bg, fg: style.header.fg, bold: true }
      : opts.totalRow && i === rows - 1
        ? { bg: style.band1, bold: true }
        : { bg: banded && i % 2 === 1 ? style.band1 : style.band2 },
  );
}

/* ---------- v60 What-if: one- and two-variable data tables ---------- */
export async function dataTable1(inputs: number[], evaluate: (x: number) => Promise<number>): Promise<number[]> {
  const out: number[] = [];
  for (const x of inputs) out.push(await evaluate(x));
  return out;
}
export async function dataTable2(
  rowInputs: number[],
  colInputs: number[],
  evaluate: (r: number, c: number) => Promise<number>,
): Promise<number[][]> {
  const out: number[][] = [];
  for (const c of colInputs) {
    const line: number[] = [];
    for (const r of rowInputs) line.push(await evaluate(r, c));
    out.push(line);
  }
  return out;
}

/* ---------- v53 Text to Columns (any delimiter, quotes, merge consecutive) ---------- */
export function splitText(text: string, opts: { delim: string; merge?: boolean; qualifier?: string }): string[] {
  const { delim, merge = false, qualifier = '"' } = opts;
  const out: string[] = [];
  let cur = '';
  let q = false;
  let lastWasDelim = false;
  if (!delim) return [text];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (qualifier && ch === qualifier) {
      if (q && text[i + 1] === qualifier) {
        cur += qualifier;
        i++;
      } else q = !q;
      lastWasDelim = false;
      continue;
    }
    if (!q && text.startsWith(delim, i)) {
      if (!(merge && lastWasDelim)) out.push(cur);
      cur = '';
      lastWasDelim = true;
      i += delim.length - 1;
      continue;
    }
    cur += ch;
    lastWasDelim = false;
  }
  out.push(cur);
  return out;
}

/** Excel "current region": the contiguous block of non-blank cells around (row, col), including diagonals. */
export function currentRegion(
  grid: Cell[][],
  row: number,
  col: number,
): { r1: number; c1: number; r2: number; c2: number } | null {
  const H = grid.length,
    W = maxOf(
      grid.map((r) => r.length),
      [0],
    );
  if (row < 0 || row >= H || col < 0 || col >= W || isBlank(grid[row]?.[col])) return null;
  let r1 = row,
    r2 = row,
    c1 = col,
    c2 = col,
    grew = true;
  const filled = (r: number, c: number) => r >= 0 && r < H && c >= 0 && c < W && !isBlank(grid[r]?.[c]);
  while (grew) {
    grew = false;
    const rowHas = (r: number) => {
      for (let c = c1 - 1; c <= c2 + 1; c++) if (filled(r, c)) return true;
      return false;
    };
    const colHas = (c: number) => {
      for (let r = r1 - 1; r <= r2 + 1; r++) if (filled(r, c)) return true;
      return false;
    };
    if (r1 > 0 && rowHas(r1 - 1)) {
      r1--;
      grew = true;
    }
    if (r2 < H - 1 && rowHas(r2 + 1)) {
      r2++;
      grew = true;
    }
    if (c1 > 0 && colHas(c1 - 1)) {
      c1--;
      grew = true;
    }
    if (c2 < W - 1 && colHas(c2 + 1)) {
      c2++;
      grew = true;
    }
  }
  return { r1, c1, r2, c2 };
}

/** Parse numbers from display text such as "$1,800.00 ", "(5)", "25%", "1e3". */
export function parseDisplayNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  let s = v.trim();
  if (s === '') return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  let pct = false;
  if (s.endsWith('%')) {
    pct = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/[$€£¥₹,\s]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  let n = Number(s);
  if (pct) n /= 100;
  return neg ? -n : n;
}

/** Split "1, 2, 3" / newline / semicolon separated numbers. */
export const parseNumberList = (s: string): number[] =>
  s
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));

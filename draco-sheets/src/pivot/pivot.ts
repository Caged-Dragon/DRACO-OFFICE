import { maxOf, minOf } from '../safeMath';
// PivotTable engine (v73-v77). Pure functions; the engine glue lives in pivotGlue.ts.
export type Cell = string | number | boolean | null | undefined;
export type Agg = 'sum' | 'count' | 'counta' | 'average' | 'max' | 'min' | 'product' | 'stdev' | 'stdevp' | 'var' | 'varp' | 'distinct';
export type ShowAs = 'normal' | 'pctGrand' | 'pctCol' | 'pctRow' | 'diffPrev' | 'pctDiffPrev' | 'running' | 'rankAsc' | 'rankDesc' | 'index';
export interface ValueField { field: string; agg: Agg; as?: ShowAs; name?: string; fmt?: 'general' | 'number' | 'percent' | 'currency' }
export interface Bin { start: number; step: number }
export interface PivotConfig {
  rows: string[]; cols: string[]; values: ValueField[];
  filters: Array<{ field: string; exclude: string[] }>;
  bins?: Record<string, Bin>;
  calc?: Array<{ name: string; formula: string }>;
  timeline?: { field: string; from: number; to: number } | null; // date serial range on a date field
  layout: 'compact' | 'outline' | 'tabular';
  subtotals: boolean; grandRows: boolean; grandCols: boolean;
  sort?: Record<string, 'asc' | 'desc'>; sortByValue?: Record<string, 'asc' | 'desc'>; // sortByValue: first value field, per row field
  top?: { field: string; n: number; dir: 'top' | 'bottom' } | null;
  emptyText?: string; blankLabel?: string;
}
export const defaultConfig = (): PivotConfig => ({ rows: [], cols: [], values: [], filters: [], layout: 'compact', subtotals: true, grandRows: true, grandCols: true });

/* ---------- dates ---------- */
const MS = 86400000; const EPOCH = Date.UTC(1899, 11, 30);
export const serialToDate = (n: number) => new Date(EPOCH + Math.floor(n) * MS);
export const dateToSerial = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / MS);
export function parseDateText(s: string): number | null {
  const t = s.trim(); let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (m) return valid(+m[3], +m[1], +m[2]); // US order m/d/yyyy
  m = t.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -,]*(\d{4})$/); if (m) { const mo = MONTHS.findIndex((x) => x.toLowerCase() === m![2].toLowerCase()); return mo >= 0 ? valid(+m[3], mo + 1, +m[1]) : null; }
  return null;
}
function valid(y: number, mo: number, d: number): number | null { if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; const dt = new Date(Date.UTC(y, mo - 1, d)); return dt.getUTCMonth() === mo - 1 ? dateToSerial(y, mo, d) : null; }
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Serial for a cell if it reads as a date (text) or is a plausible date serial when the column is flagged as dates. */
export function cellDate(v: Cell, asSerial: boolean): number | null {
  if (typeof v === 'number') return asSerial && v > 20000 && v < 80000 ? Math.floor(v) : null;
  if (typeof v === 'string' && v.trim()) return parseDateText(v);
  return null;
}
const DATE_SUFFIX = [' (Years)', ' (Quarters)', ' (Months)'] as const;

/** Header names + data rows from a source block. Duplicate/blank headers are made unique. */
export function prepareSource(block: Cell[][], dateCols: number[] = []): { fields: string[]; rows: Cell[][]; virtual: Record<string, { base: number; kind: 0 | 1 | 2 }>; dateFields: string[] } {
  const head = (block[0] ?? []).map((h, i) => (h === null || h === undefined || String(h).trim() === '' ? `Column${i + 1}` : String(h).trim())); const seen = new Map<string, number>();
  const fields = head.map((h) => { const k = h.toLowerCase(); const n = seen.get(k) ?? 0; seen.set(k, n + 1); return n ? `${h}${n + 1}` : h; });
  const body = block.slice(1).filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''));
  const virtual: Record<string, { base: number; kind: 0 | 1 | 2 }> = {}; const dateFields: string[] = []; const vf: string[] = [];
  fields.forEach((f, c) => {
    const vals = body.map((r) => r[c]).filter((v) => v !== null && v !== undefined && v !== ''); if (!vals.length) return;
    const flagged = dateCols.includes(c); const hits = vals.filter((v) => cellDate(v, flagged) !== null).length;
    if (hits / vals.length >= 0.8 && (flagged || typeof vals[0] === 'string')) { dateFields.push(f); DATE_SUFFIX.forEach((sfx, k) => { const n = f + sfx; virtual[n] = { base: c, kind: k as 0 | 1 | 2 }; vf.push(n); }); }
  });
  const rows = body.map((r) => { const out = fields.map((_, c) => r[c]); for (const n of vf) { const { base, kind } = virtual[n]; const s = cellDate(r[base], dateCols.includes(base)); out.push(s === null ? null : derive(s, kind)); } return out; });
  return { fields: [...fields, ...vf], rows, virtual, dateFields };
}
function derive(serial: number, kind: 0 | 1 | 2): string { const d = serialToDate(serial); return kind === 0 ? String(d.getUTCFullYear()) : kind === 1 ? `Qtr${Math.floor(d.getUTCMonth() / 3) + 1}` : MONTHS[d.getUTCMonth()]; }

/* ---------- calculated fields: tiny expression parser over field names ---------- */
type Expr = { t: 'n'; v: number } | { t: 'f'; name: string } | { t: 'u'; e: Expr } | { t: 'b'; op: string; l: Expr; r: Expr };
export function parseCalc(src: string, known: string[]): Expr {
  const low = new Map(known.map((k) => [k.toLowerCase(), k])); let i = 0;
  const ws = () => { while (src[i] === ' ') i++; };
  const prim = (): Expr => {
    ws(); const c = src[i];
    if (c === '(') { i++; const e = add(); ws(); if (src[i] !== ')') throw new Error('Missing )'); i++; return e; }
    if (c === '-') { i++; return { t: 'u', e: pow() }; } if (c === '+') { i++; return pow(); }
    if (c === "'") { const j = src.indexOf("'", i + 1); if (j < 0) throw new Error("Missing '"); const nm = src.slice(i + 1, j); i = j + 1; const k = low.get(nm.toLowerCase()); if (!k) throw new Error(`Unknown field "${nm}"`); return { t: 'f', name: k }; }
    const num = src.slice(i).match(/^\d+(\.\d+)?/); if (num) { i += num[0].length; return { t: 'n', v: +num[0] }; }
    // longest known field name that matches here (names may contain spaces)
    const rest = src.slice(i).toLowerCase(); let best = ''; for (const k of low.keys()) if (rest.startsWith(k) && k.length > best.length && !/[A-Za-z0-9_]/.test(rest[k.length] ?? ' ')) best = k;
    if (best) { i += best.length; return { t: 'f', name: low.get(best)! }; }
    throw new Error(`Unexpected "${src.slice(i, i + 12)}"`);
  };
  const pow = (): Expr => { let l = prim(); ws(); while (src[i] === '^') { i++; const r = prim(); l = { t: 'b', op: '^', l, r }; ws(); } return l; };
  const mul = (): Expr => { let l = pow(); ws(); while (src[i] === '*' || src[i] === '/') { const op = src[i++]; const r = pow(); l = { t: 'b', op, l, r }; ws(); } return l; };
  const add = (): Expr => { let l = mul(); ws(); while (src[i] === '+' || src[i] === '-') { const op = src[i++]; const r = mul(); l = { t: 'b', op, l, r }; ws(); } return l; };
  const e = add(); ws(); if (i < src.length) throw new Error(`Unexpected "${src.slice(i, i + 12)}"`); return e;
}
export function evalCalc(e: Expr, val: (f: string) => number): number {
  switch (e.t) { case 'n': return e.v; case 'f': return val(e.name); case 'u': return -evalCalc(e.e, val);
    case 'b': { const a = evalCalc(e.l, val), b = evalCalc(e.r, val); return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : e.op === '/' ? (b === 0 ? NaN : a / b) : a ** b; } }
}
export const calcDeps = (e: Expr): string[] => (e.t === 'f' ? [e.name] : e.t === 'u' ? calcDeps(e.e) : e.t === 'b' ? [...calcDeps(e.l), ...calcDeps(e.r)] : []);

/* ---------- aggregation ---------- */
const num = (v: Cell): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v.replace(/[,$%\s]/g, '')) ? +v.replace(/[,$%\s]/g, '') : null);
export function aggregate(agg: Agg, vals: Cell[]): number | null {
  const present = vals.filter((v) => v !== null && v !== undefined && v !== ''); const ns = vals.map(num).filter((x): x is number => x !== null);
  switch (agg) {
    case 'count': return ns.length; case 'counta': return present.length; case 'distinct': return new Set(present.map((v) => String(v))).size;
    case 'sum': return ns.length ? ns.reduce((a, b) => a + b, 0) : 0;
    case 'average': return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
    case 'max': return ns.length ? maxOf(ns) : null; case 'min': return ns.length ? minOf(ns) : null;
    case 'product': return ns.length ? ns.reduce((a, b) => a * b, 1) : 0;
    case 'stdev': case 'var': { if (ns.length < 2) return null; const m = ns.reduce((a, b) => a + b, 0) / ns.length; const v = ns.reduce((a, b) => a + (b - m) ** 2, 0) / (ns.length - 1); return agg === 'var' ? v : Math.sqrt(v); }
    case 'stdevp': case 'varp': { if (!ns.length) return null; const m = ns.reduce((a, b) => a + b, 0) / ns.length; const v = ns.reduce((a, b) => a + (b - m) ** 2, 0) / ns.length; return agg === 'varp' ? v : Math.sqrt(v); }
  }
}
export const AGG_LABEL: Record<Agg, string> = { sum: 'Sum', count: 'Count numbers', counta: 'Count', average: 'Average', max: 'Max', min: 'Min', product: 'Product', stdev: 'StdDev', stdevp: 'StdDevp', var: 'Var', varp: 'Varp', distinct: 'Distinct count' };
export const SHOW_AS_LABEL: Record<ShowAs, string> = { normal: 'No calculation', pctGrand: '% of grand total', pctCol: '% of column total', pctRow: '% of row total', diffPrev: 'Difference from previous', pctDiffPrev: '% difference from previous', running: 'Running total', rankAsc: 'Rank smallest to largest', rankDesc: 'Rank largest to smallest', index: 'Index' };
export const valueTitle = (v: ValueField) => v.name?.trim() || `${AGG_LABEL[v.agg]} of ${v.field}`;

/* ---------- compute ---------- */
export interface PCell { v: string | number | null; kind: 'corner' | 'colhead' | 'rowhead' | 'value' | 'subtotal' | 'total' | 'filter' | 'blank'; fmt?: string; indent?: number }
export interface PivotResult { grid: PCell[][]; rows: number; cols: number; dataRect: { r0: number; c0: number; r1: number; c1: number } | null; headRows: number; labelCols: number; error?: string; recordCount: number }
interface Node { key: string; sort: number | string; label: string; children: Map<string, Node>; path: string[] }
const newNode = (key: string, sort: number | string, path: string[]): Node => ({ key, sort, label: key, children: new Map(), path });
const FMT: Record<string, string> = { general: '', number: '#,##0.00', percent: '0.00%', currency: '$#,##0.00' };

export function computePivot(source: { fields: string[]; rows: Cell[][] }, cfg: PivotConfig): PivotResult {
  const empty = (error: string): PivotResult => ({ grid: [], rows: 0, cols: 0, dataRect: null, headRows: 0, labelCols: 0, error, recordCount: 0 });
  const idx = new Map(source.fields.map((f, i) => [f, i])); const need = [...cfg.rows, ...cfg.cols, ...cfg.values.map((v) => v.field), ...cfg.filters.map((f) => f.field)];
  const calcs = cfg.calc ?? []; const calcNames = new Set(calcs.map((c) => c.name));
  for (const f of need) if (!idx.has(f) && !calcNames.has(f)) return empty(`Field "${f}" isn't in the source data.`);
  if (!cfg.values.length) return empty('Add at least one value field.');
  const blank = cfg.blankLabel ?? '(blank)';
  // calculated fields
  const parsed = new Map<string, Expr>(); for (const c of calcs) { try { parsed.set(c.name, parseCalc(c.formula, source.fields)); } catch (e) { return empty(`Calculated field "${c.name}": ${(e as Error).message}`); } }
  // filter rows
  let recs = source.rows;
  for (const f of cfg.filters) { const c = idx.get(f.field)!; const ex = new Set(f.exclude); if (ex.size) recs = recs.filter((r) => !ex.has(keyOf(r[c], f.field))); }
  if (cfg.timeline) { const c = idx.get(cfg.timeline.field); if (c !== undefined) recs = recs.filter((r) => { const s = cellDate(r[c], true); return s !== null && s >= cfg.timeline!.from && s <= cfg.timeline!.to; }); }
  function keyOf(v: Cell, field: string): string {
    const b = cfg.bins?.[field]; if (b) { const n = num(v); if (n === null) return blank; const k = Math.floor((n - b.start) / b.step); const lo = b.start + k * b.step; return `${lo}-${lo + b.step - 1}`; }
    return v === null || v === undefined || v === '' ? blank : typeof v === 'number' ? String(v) : String(v);
  }
  const sortKey = (field: string, key: string): number | string => {
    if (key === blank) return '\uffff'; if (field.endsWith(' (Months)')) { const m = MONTHS.indexOf(key); return m < 0 ? key : m; } if (field.endsWith(' (Quarters)')) return key; const b = cfg.bins?.[field]; if (b) return parseFloat(key);
    const n = Number(key); return key.trim() !== '' && Number.isFinite(n) ? n : key.toLowerCase();
  };
  const cmp = (a: number | string, b: number | string, dir: 'asc' | 'desc' = 'asc') => { const r = typeof a === 'number' && typeof b === 'number' ? a - b : typeof a === 'number' ? -1 : typeof b === 'number' ? 1 : String(a).localeCompare(String(b)); return dir === 'asc' ? r : -r; };
  const build = (fields: string[]): Node => {
    const root = newNode('', 0, []);
    for (const r of recs) { let n = root; fields.forEach((f, d) => { const k = keyOf(r[idx.get(f)!], f); let ch = n.children.get(k); if (!ch) { ch = newNode(k, sortKey(f, k), [...n.path, k]); n.children.set(k, ch); } n = ch; void d; }); }
    return root;
  };
  const rowRoot = build(cfg.rows), colRoot = build(cfg.cols);
  // accumulate values per (row path, col path) at every prefix depth
  const cell = new Map<string, Cell[][]>(); // key -> per value-field list of raw values (for calc fields: per source field lists)
  const srcFields = [...new Set([...cfg.values.filter((v) => !calcNames.has(v.field)).map((v) => v.field), ...[...parsed.values()].flatMap(calcDeps)])];
  const ck = (rp: string[], cp: string[]) => rp.join('\u0001') + '\u0002' + cp.join('\u0001');
  for (const r of recs) {
    const rk = cfg.rows.map((f) => keyOf(r[idx.get(f)!], f)), ckeys = cfg.cols.map((f) => keyOf(r[idx.get(f)!], f));
    for (let a = 0; a <= rk.length; a++) for (let b = 0; b <= ckeys.length; b++) {
      const key = ck(rk.slice(0, a), ckeys.slice(0, b)); let acc = cell.get(key); if (!acc) { acc = srcFields.map(() => []); cell.set(key, acc); }
      srcFields.forEach((f, i) => acc![i].push(r[idx.get(f)!]));
    }
  }
  const srcIdx = new Map(srcFields.map((f, i) => [f, i]));
  const valueOf = (rp: string[], cp: string[], vf: ValueField): number | null => {
    const acc = cell.get(ck(rp, cp)); if (!acc) return null;
    const e = parsed.get(vf.field); if (e) { const x = evalCalc(e, (f) => aggregate('sum', acc[srcIdx.get(f)!] ?? []) ?? 0); return Number.isFinite(x) ? x : null; }
    return aggregate(vf.agg, acc[srcIdx.get(vf.field)!] ?? []);
  };
  // ordering of children (sort by label or by value)
  const ordered = (n: Node, depthField: string | undefined, isRow: boolean, vfirst: ValueField): Node[] => {
    let list = [...n.children.values()]; const byVal = isRow && depthField ? cfg.sortByValue?.[depthField] : undefined; const dir = cfg.sort?.[depthField ?? ''] ?? 'asc';
    if (byVal) list.sort((a, b) => { const va = valueOf(a.path, [], vfirst) ?? -Infinity, vb = valueOf(b.path, [], vfirst) ?? -Infinity; return byVal === 'asc' ? va - vb : vb - va; });
    else list.sort((a, b) => cmp(a.sort, b.sort, dir));
    if (isRow && cfg.top && cfg.top.field === depthField) { const t = cfg.top; const ranked = [...list].sort((a, b) => ((valueOf(b.path, [], vfirst) ?? -Infinity) - (valueOf(a.path, [], vfirst) ?? -Infinity)) * (t.dir === 'top' ? 1 : -1)); const keep = new Set(ranked.slice(0, t.n).map((x) => x.key)); list = list.filter((x) => keep.has(x.key)); }
    return list;
  };
  const v0 = cfg.values[0];
  // column leaves / structure
  type CCol = { path: string[]; depth: number; isTotal: boolean; label: string; groupLabels: string[] };
  const colList: CCol[] = [];
  const walkCols = (n: Node, depth: number) => {
    const kids = ordered(n, cfg.cols[depth], false, v0);
    if (!kids.length) return;
    for (const k of kids) {
      if (k.children.size) { walkCols(k, depth + 1); if (cfg.subtotals && cfg.grandCols !== undefined) colList.push({ path: k.path, depth: depth + 1, isTotal: true, label: `${k.key} Total`, groupLabels: [...k.path] }); }
      else colList.push({ path: k.path, depth: depth + 1, isTotal: false, label: k.key, groupLabels: [...k.path] });
    }
  };
  if (cfg.cols.length) walkCols(colRoot, 0);
  if (cfg.cols.length && cfg.grandRows) colList.push({ path: [], depth: 0, isTotal: true, label: 'Grand Total', groupLabels: ['Grand Total'] });
  const hasCols = cfg.cols.length > 0; const nv = cfg.values.length;
  // value columns: each CCol × each value field
  const vcols: Array<{ c: CCol | null; vi: number }> = [];
  if (!hasCols) cfg.values.forEach((_, vi) => vcols.push({ c: null, vi })); else for (const c of colList) cfg.values.forEach((_, vi) => vcols.push({ c, vi }));
  // row structure
  type RRow = { path: string[]; depth: number; kind: 'leaf' | 'group' | 'subtotal' | 'grand'; label: string };
  const rowList: RRow[] = [];
  const walkRows = (n: Node, depth: number) => {
    const kids = ordered(n, cfg.rows[depth], true, v0);
    for (const k of kids) {
      if (k.children.size) {
        if (cfg.layout === 'tabular') { walkRows(k, depth + 1); if (cfg.subtotals) rowList.push({ path: k.path, depth: depth + 1, kind: 'subtotal', label: `${k.key} Total` }); }
        else { rowList.push({ path: k.path, depth: depth + 1, kind: 'group', label: k.key }); walkRows(k, depth + 1); }
      } else rowList.push({ path: k.path, depth: depth + 1, kind: 'leaf', label: k.key });
    }
  };
  if (cfg.rows.length) walkRows(rowRoot, 0);
  if (cfg.grandCols || !cfg.rows.length) rowList.push({ path: [], depth: 0, kind: 'grand', label: 'Grand Total' });
  // raw numeric matrix for show-as
  const colPathOf = (vc: (typeof vcols)[number]) => vc.c?.path ?? [];
  const grandOf = (vi: number) => valueOf([], [], cfg.values[vi]);
  const show = (rr: RRow, vc: (typeof vcols)[number], rowIdx: number): number | string | null => {
    const vf = cfg.values[vc.vi]; const cp = colPathOf(vc); const raw = valueOf(rr.path, cp, vf); if (raw === null) return cfg.emptyText ?? null;
    const as = vf.as ?? 'normal'; if (as === 'normal') return raw;
    const div = (a: number | null, b: number | null) => (a === null || !b ? null : a / b);
    if (as === 'pctGrand') return div(raw, grandOf(vc.vi)) ?? '';
    if (as === 'pctCol') return div(raw, valueOf([], cp, vf)) ?? '';
    if (as === 'pctRow') return div(raw, valueOf(rr.path, [], vf)) ?? '';
    if (as === 'index') { const rt = valueOf(rr.path, [], vf), ct = valueOf([], cp, vf), g = grandOf(vc.vi); return rt && ct && g && raw !== null ? (raw * g) / (rt * ct) : ''; }
    // sibling-relative: previous/running/rank among rows with the same parent at the same depth
    const sibs = rowList.filter((x) => x.depth === rr.depth && x.kind !== 'grand' && x.path.slice(0, -1).join('\u0001') === rr.path.slice(0, -1).join('\u0001') && (x.kind === rr.kind || (x.kind !== 'subtotal' && rr.kind !== 'subtotal')));
    const pos = sibs.indexOf(rr); const vals = sibs.map((s) => valueOf(s.path, cp, vf));
    if (as === 'diffPrev') return pos <= 0 || vals[pos - 1] === null ? '' : raw - (vals[pos - 1] as number);
    if (as === 'pctDiffPrev') return pos <= 0 || !vals[pos - 1] ? '' : (raw - (vals[pos - 1] as number)) / (vals[pos - 1] as number);
    if (as === 'running') return vals.slice(0, pos + 1).reduce<number>((a, b) => a + (b ?? 0), 0);
    if (as === 'rankAsc' || as === 'rankDesc') { const ns = vals.filter((x): x is number => x !== null); return 1 + ns.filter((x) => (as === 'rankAsc' ? x < raw : x > raw)).length; }
    void rowIdx; return raw;
  };
  const showFmt = (vf: ValueField) => { const as = vf.as ?? 'normal'; if (['pctGrand', 'pctCol', 'pctRow', 'pctDiffPrev'].includes(as)) return '0.00%'; if (as === 'rankAsc' || as === 'rankDesc') return '0'; if (as === 'index') return '0.00'; return FMT[vf.fmt ?? 'general']; };
  // assemble the grid
  const labelCols = cfg.layout === 'compact' ? 1 : Math.max(1, cfg.rows.length); const colDepth = cfg.cols.length;
  const headRows = (hasCols ? colDepth + (nv > 1 ? 1 : 0) : 0) + 1; const W = labelCols + vcols.length; const grid: PCell[][] = [];
  const fillRow = (kind: PCell['kind'] = 'blank') => Array.from({ length: W }, () => ({ v: null, kind }) as PCell);
  // header block
  if (!hasCols) { const h = fillRow('colhead'); h[0] = { v: cfg.layout === 'compact' ? (cfg.rows.length ? 'Row Labels' : '') : cfg.rows[0] ?? '', kind: 'corner' }; for (let i = 1; i < labelCols; i++) h[i] = { v: cfg.rows[i] ?? '', kind: 'corner' }; vcols.forEach((vc, j) => { h[labelCols + j] = { v: valueTitle(cfg.values[vc.vi]), kind: 'colhead' }; }); grid.push(h); }
  else {
    // Excel layout: a title row ("Sum of Sales | Column Labels"), then one row per column field, then (several values) a row of value titles
    const t = fillRow('colhead'); t[0] = { v: nv === 1 ? valueTitle(v0) : 'Values', kind: 'corner' }; t[labelCols] = { v: 'Column Labels', kind: 'colhead' }; grid.push(t);
    const lastIsValues = nv > 1; const rowLabels = (r: PCell[]) => { for (let i = 0; i < labelCols; i++) r[i] = { v: cfg.layout === 'compact' ? (i === 0 && cfg.rows.length ? 'Row Labels' : '') : cfg.rows[i] ?? '', kind: 'corner' }; };
    for (let d = 0; d < colDepth; d++) {
      const r = fillRow('colhead'); if (!lastIsValues && d === colDepth - 1) rowLabels(r); else for (let i = 0; i < labelCols; i++) r[i] = { v: '', kind: 'corner' };
      vcols.forEach((vc, j) => {
        const c = vc.c!; const prev = j > 0 ? vcols[j - 1].c : null; let v = '';
        if (c.isTotal) v = d === 0 && (j === 0 || prev !== c) ? c.label : '';
        else { const same = prev && !prev.isTotal && prev.path.slice(0, d + 1).join('\u0001') === c.path.slice(0, d + 1).join('\u0001'); v = same ? '' : c.path[d] ?? ''; }
        r[labelCols + j] = { v, kind: 'colhead' };
      });
      grid.push(r);
    }
    if (lastIsValues) { const lab = fillRow('colhead'); rowLabels(lab); vcols.forEach((vc, j) => { lab[labelCols + j] = { v: valueTitle(cfg.values[vc.vi]), kind: 'colhead' }; }); grid.push(lab); }
  }
  const headerCount = grid.length; const firstData = headerCount; let dataLast = -1; let dataFirstCol = labelCols;
  // body
  rowList.forEach((rr, ri) => {
    const row = fillRow(); const isTot = rr.kind === 'grand', isSub = rr.kind === 'subtotal' || rr.kind === 'group';
    if (cfg.layout === 'compact') row[0] = { v: rr.kind === 'grand' ? 'Grand Total' : rr.label, kind: isTot ? 'total' : rr.kind === 'leaf' ? 'rowhead' : 'subtotal', indent: rr.kind === 'grand' ? 0 : rr.depth - 1 };
    else { const outl = cfg.layout === 'outline'; if (rr.kind === 'grand') row[0] = { v: 'Grand Total', kind: 'total' }; else if (rr.kind === 'subtotal') row[Math.max(0, rr.depth - 1)] = { v: rr.label, kind: 'subtotal' }; else if (outl && rr.kind === 'group') row[rr.depth - 1] = { v: rr.label, kind: 'subtotal' }; else if (rr.kind === 'leaf') { for (let d = 0; d < rr.depth; d++) row[d] = { v: outl ? (d === rr.depth - 1 ? rr.path[d] : null) : rr.path[d], kind: 'rowhead' }; } }
    vcols.forEach((vc, j) => { const v = show(rr, vc, ri); const kind: PCell['kind'] = isTot || vc.c?.isTotal ? 'total' : isSub ? 'subtotal' : 'value'; row[labelCols + j] = { v, kind, fmt: showFmt(cfg.values[vc.vi]) }; });
    if (rr.kind === 'group' && cfg.layout !== 'tabular') { /* group header carries subtotals only when enabled */ if (!cfg.subtotals) vcols.forEach((_, j) => { row[labelCols + j] = { v: null, kind: 'blank' }; }); }
    grid.push(row); dataLast = grid.length - 1;
  });
  if (cfg.rows.length === 0 && !rowList.length) { /* nothing */ }
  // data rect for charts: leaf rows × non-total value columns
  const leafIdx = rowList.map((r, i) => ({ r, i })).filter((x) => x.r.kind === 'leaf' || (cfg.layout !== 'tabular' && !cfg.rows.length));
  const colIdx = vcols.map((v, j) => ({ v, j })).filter((x) => !x.v.c?.isTotal);
  const dataRect = leafIdx.length && colIdx.length ? { r0: firstData + leafIdx[0].i, c0: dataFirstCol + colIdx[0].j, r1: firstData + leafIdx[leafIdx.length - 1].i, c1: dataFirstCol + colIdx[colIdx.length - 1].j } : null;
  void dataLast;
  return { grid, rows: grid.length, cols: W, dataRect, headRows: headerCount, labelCols, recordCount: recs.length };
}

/** Distinct item labels of a field (after nothing is filtered) for filter/slicer lists. */
export function fieldItems(source: { fields: string[]; rows: Cell[][] }, field: string, bin?: Bin): string[] {
  const c = source.fields.indexOf(field); if (c < 0) return []; const set = new Map<string, number | string>();
  for (const r of source.rows) { const v = r[c]; let k = v === null || v === undefined || v === '' ? '(blank)' : String(v); if (bin) { const n = num(v); if (n !== null) { const lo = bin.start + Math.floor((n - bin.start) / bin.step) * bin.step; k = `${lo}-${lo + bin.step - 1}`; } } if (!set.has(k)) { const n = Number(k); set.set(k, k === '(blank)' ? '\uffff' : MONTHS.indexOf(k) >= 0 && field.endsWith('(Months)') ? MONTHS.indexOf(k) : Number.isFinite(n) && k.trim() ? n : k.toLowerCase()); } }
  return [...set.entries()].sort((a, b) => (typeof a[1] === 'number' && typeof b[1] === 'number' ? a[1] - b[1] : String(a[1]).localeCompare(String(b[1])))).map((x) => x[0]);
}

// Power-Query-lite (v78): import -> transform steps -> table. Pure functions.
import { aggregate, parseCalc, evalCalc, parseDateText, serialToDate, type Agg, type Cell } from '../pivot/pivot';
import { maxOf } from '../formulas/safeMath';
export interface Table {
  cols: string[];
  rows: Cell[][];
}
export type FilterOp =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isBlank'
  | 'notBlank';
export type Step =
  | { t: 'filter'; col: string; op: FilterOp; value?: string }
  | { t: 'removeCols'; cols: string[] }
  | { t: 'keepCols'; cols: string[] }
  | { t: 'rename'; from: string; to: string }
  | { t: 'type'; col: string; to: 'number' | 'text' | 'date' | 'boolean' }
  | { t: 'sort'; keys: Array<{ col: string; dir: 'asc' | 'desc' }> }
  | { t: 'split'; col: string; delim: string; keep?: boolean }
  | { t: 'merge'; cols: string[]; sep: string; name: string }
  | { t: 'addCol'; name: string; formula: string }
  | { t: 'replace'; col: string; find: string; with: string }
  | { t: 'text'; col: string; op: 'trim' | 'upper' | 'lower' | 'proper' | 'clean' }
  | { t: 'dedupe'; cols?: string[] }
  | { t: 'removeBlankRows' }
  | { t: 'fillDown'; col: string }
  | { t: 'keepRows'; n: number; from: 'top' | 'bottom' }
  | { t: 'removeRows'; n: number; from: 'top' | 'bottom' }
  | { t: 'group'; by: string[]; aggs: Array<{ col: string; agg: Agg; name?: string }> }
  | { t: 'unpivot'; keep: string[]; attr: string; val: string }
  | { t: 'append'; src: string }
  | { t: 'join'; src: string; left: string; right: string; kind: 'inner' | 'left' };
export type Resolver = (src: string) => Table | null;
const blank = (v: Cell) => v === null || v === undefined || v === '';
const toNum = (v: Cell): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v.replace(/[,$%\s]/g, ''))
      ? +v.replace(/[,$%\s]/g, '')
      : null;

export function describeStep(s: Step): string {
  switch (s.t) {
    case 'filter':
      return `Filter ${s.col} ${s.op}${['isBlank', 'notBlank'].includes(s.op) ? '' : ' "' + s.value + '"'}`;
    case 'removeCols':
      return `Remove columns: ${s.cols.join(', ')}`;
    case 'keepCols':
      return `Keep columns: ${s.cols.join(', ')}`;
    case 'rename':
      return `Rename ${s.from} → ${s.to}`;
    case 'type':
      return `Change ${s.col} to ${s.to}`;
    case 'sort':
      return `Sort by ${s.keys.map((k) => `${k.col} ${k.dir}`).join(', ')}`;
    case 'split':
      return `Split ${s.col} by "${s.delim}"`;
    case 'merge':
      return `Merge ${s.cols.join(', ')} → ${s.name}`;
    case 'addCol':
      return `Add column ${s.name} = ${s.formula}`;
    case 'replace':
      return `Replace "${s.find}" with "${s.with}" in ${s.col}`;
    case 'text':
      return `${s.op} ${s.col}`;
    case 'dedupe':
      return `Remove duplicates${s.cols?.length ? ' on ' + s.cols.join(', ') : ''}`;
    case 'removeBlankRows':
      return 'Remove blank rows';
    case 'fillDown':
      return `Fill down ${s.col}`;
    case 'keepRows':
      return `Keep ${s.from} ${s.n} rows`;
    case 'removeRows':
      return `Remove ${s.from} ${s.n} rows`;
    case 'group':
      return `Group by ${s.by.join(', ') || '(all)'}: ${s.aggs.map((a) => `${a.agg}(${a.col})`).join(', ')}`;
    case 'unpivot':
      return `Unpivot all but ${s.keep.join(', ')}`;
    case 'append':
      return `Append ${s.src}`;
    case 'join':
      return `${s.kind} join ${s.src} on ${s.left}=${s.right}`;
  }
}
const need = (t: Table, ...cols: string[]) => {
  for (const c of cols) if (!t.cols.includes(c)) throw new Error(`Column "${c}" not found`);
};
const matches = (v: Cell, op: FilterOp, ref: string | undefined): boolean => {
  if (op === 'isBlank') return blank(v);
  if (op === 'notBlank') return !blank(v);
  const s = blank(v) ? '' : String(v);
  const r = ref ?? '';
  const a = toNum(v),
    b = toNum(r);
  switch (op) {
    case '=':
      return a !== null && b !== null ? a === b : s.toLowerCase() === r.toLowerCase();
    case '!=':
      return a !== null && b !== null ? a !== b : s.toLowerCase() !== r.toLowerCase();
    case '>':
      return a !== null && b !== null ? a > b : s.localeCompare(r) > 0;
    case '>=':
      return a !== null && b !== null ? a >= b : s.localeCompare(r) >= 0;
    case '<':
      return a !== null && b !== null ? a < b : s.localeCompare(r) < 0;
    case '<=':
      return a !== null && b !== null ? a <= b : s.localeCompare(r) <= 0;
    case 'contains':
      return s.toLowerCase().includes(r.toLowerCase());
    case 'notContains':
      return !s.toLowerCase().includes(r.toLowerCase());
    case 'startsWith':
      return s.toLowerCase().startsWith(r.toLowerCase());
    case 'endsWith':
      return s.toLowerCase().endsWith(r.toLowerCase());
  }
};
const proper = (s: string) => s.toLowerCase().replace(/(^|[^a-z0-9'])([a-z])/g, (_, p, c) => p + c.toUpperCase());

export function applyStep(t: Table, s: Step, resolve?: Resolver): Table {
  const ci = (c: string) => t.cols.indexOf(c);
  switch (s.t) {
    case 'filter': {
      need(t, s.col);
      const c = ci(s.col);
      return { cols: t.cols, rows: t.rows.filter((r) => matches(r[c], s.op, s.value)) };
    }
    case 'removeCols': {
      need(t, ...s.cols);
      const keep = t.cols.map((c, i) => ({ c, i })).filter((x) => !s.cols.includes(x.c));
      return { cols: keep.map((x) => x.c), rows: t.rows.map((r) => keep.map((x) => r[x.i])) };
    }
    case 'keepCols': {
      need(t, ...s.cols);
      const idx = s.cols.map(ci);
      return { cols: [...s.cols], rows: t.rows.map((r) => idx.map((i) => r[i])) };
    }
    case 'rename': {
      need(t, s.from);
      if (s.from !== s.to && t.cols.includes(s.to)) throw new Error(`Column "${s.to}" already exists`);
      return { cols: t.cols.map((c) => (c === s.from ? s.to : c)), rows: t.rows };
    }
    case 'type': {
      need(t, s.col);
      const c = ci(s.col);
      const conv = (v: Cell): Cell => {
        if (blank(v)) return null;
        if (s.to === 'text') return String(v);
        if (s.to === 'number') return toNum(v);
        if (s.to === 'boolean') {
          const x = String(v).toLowerCase();
          return ['true', 'yes', '1'].includes(x) ? true : ['false', 'no', '0'].includes(x) ? false : null;
        }
        const d = typeof v === 'number' ? Math.floor(v) : parseDateText(String(v));
        return d === null ? null : serialToDate(d).toISOString().slice(0, 10);
      };
      return { cols: t.cols, rows: t.rows.map((r) => r.map((v, i) => (i === c ? conv(v) : v))) };
    }
    case 'sort': {
      need(t, ...s.keys.map((k) => k.col));
      const ks = s.keys.map((k) => ({ i: ci(k.col), d: k.dir === 'asc' ? 1 : -1 }));
      return {
        cols: t.cols,
        rows: [...t.rows].sort((a, b) => {
          for (const k of ks) {
            const x = a[k.i],
              y = b[k.i];
            if (blank(x) !== blank(y)) return blank(x) ? 1 : -1;
            const nx = toNum(x),
              ny = toNum(y);
            const r = nx !== null && ny !== null ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''));
            if (r) return r * k.d;
          }
          return 0;
        }),
      };
    }
    case 'split': {
      need(t, s.col);
      const c = ci(s.col);
      const parts = t.rows.map((r) => (blank(r[c]) ? [] : String(r[c]).split(s.delim)));
      const n = maxOf(
        parts.map((p) => p.length),
        [1],
      );
      const names = Array.from({ length: n }, (_, k) => `${s.col}.${k + 1}`);
      const cols = [...t.cols.slice(0, c), ...names, ...t.cols.slice(c + 1)];
      return {
        cols,
        rows: t.rows.map((r, ri) => [
          ...r.slice(0, c),
          ...names.map((_, k) => {
            const x = parts[ri][k];
            return x === undefined ? null : (toNum(x) ?? x.trim());
          }),
          ...r.slice(c + 1),
        ]),
      };
    }
    case 'merge': {
      need(t, ...s.cols);
      const idx = s.cols.map(ci);
      if (t.cols.includes(s.name)) throw new Error(`Column "${s.name}" already exists`);
      return {
        cols: [...t.cols, s.name],
        rows: t.rows.map((r) => [...r, idx.map((i) => (blank(r[i]) ? '' : String(r[i]))).join(s.sep)]),
      };
    }
    case 'addCol': {
      if (t.cols.includes(s.name)) throw new Error(`Column "${s.name}" already exists`);
      const e = parseCalc(s.formula, t.cols);
      return {
        cols: [...t.cols, s.name],
        rows: t.rows.map((r) => {
          const x = evalCalc(e, (f) => toNum(r[ci(f)]) ?? 0);
          return [...r, Number.isFinite(x) ? x : null];
        }),
      };
    }
    case 'replace': {
      need(t, s.col);
      const c = ci(s.col);
      return {
        cols: t.cols,
        rows: t.rows.map((r) =>
          r.map((v, i) =>
            i === c && !blank(v)
              ? typeof v === 'string'
                ? v.split(s.find).join(s.with)
                : String(v) === s.find
                  ? (toNum(s.with) ?? s.with)
                  : v
              : v,
          ),
        ),
      };
    }
    case 'text': {
      need(t, s.col);
      const c = ci(s.col);
      const f = (x: string) =>
        s.op === 'trim'
          ? x.trim()
          : s.op === 'upper'
            ? x.toUpperCase()
            : s.op === 'lower'
              ? x.toLowerCase()
              : s.op === 'proper'
                ? proper(x)
                : x.replace(/[\u0000-\u001f]/g, '');
      return { cols: t.cols, rows: t.rows.map((r) => r.map((v, i) => (i === c && typeof v === 'string' ? f(v) : v))) };
    }
    case 'dedupe': {
      const idx = (s.cols?.length ? s.cols : t.cols).map((x) => {
        need(t, x);
        return ci(x);
      });
      const seen = new Set<string>();
      return {
        cols: t.cols,
        rows: t.rows.filter((r) => {
          const k = JSON.stringify(idx.map((i) => (typeof r[i] === 'string' ? (r[i] as string).toLowerCase() : r[i])));
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }),
      };
    }
    case 'removeBlankRows':
      return { cols: t.cols, rows: t.rows.filter((r) => r.some((v) => !blank(v))) };
    case 'fillDown': {
      need(t, s.col);
      const c = ci(s.col);
      let last: Cell = null;
      return {
        cols: t.cols,
        rows: t.rows.map((r) => {
          if (blank(r[c])) return r.map((v, i) => (i === c ? last : v));
          last = r[c];
          return r;
        }),
      };
    }
    case 'keepRows':
      return {
        cols: t.cols,
        rows: s.from === 'top' ? t.rows.slice(0, s.n) : t.rows.slice(Math.max(0, t.rows.length - s.n)),
      };
    case 'removeRows':
      return {
        cols: t.cols,
        rows: s.from === 'top' ? t.rows.slice(s.n) : t.rows.slice(0, Math.max(0, t.rows.length - s.n)),
      };
    case 'group': {
      need(t, ...s.by, ...s.aggs.map((a) => a.col));
      const bi = s.by.map(ci);
      const groups = new Map<string, Cell[][]>();
      for (const r of t.rows) {
        const k = JSON.stringify(bi.map((i) => r[i]));
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r);
      }
      const cols = [...s.by, ...s.aggs.map((a) => a.name || `${a.agg} of ${a.col}`)];
      return {
        cols,
        rows: [...groups.entries()].map(([k, rs]) => [
          ...(JSON.parse(k) as Cell[]),
          ...s.aggs.map((a) =>
            aggregate(
              a.agg,
              rs.map((r) => r[ci(a.col)]),
            ),
          ),
        ]),
      };
    }
    case 'unpivot': {
      need(t, ...s.keep);
      const ki = s.keep.map(ci);
      const others = t.cols.map((c, i) => ({ c, i })).filter((x) => !s.keep.includes(x.c));
      const out: Cell[][] = [];
      for (const r of t.rows)
        for (const o of others) if (!blank(r[o.i])) out.push([...ki.map((i) => r[i]), o.c, r[o.i]]);
      return { cols: [...s.keep, s.attr, s.val], rows: out };
    }
    case 'append': {
      const o = resolve?.(s.src);
      if (!o) throw new Error(`Source "${s.src}" not found`);
      const cols = [...t.cols, ...o.cols.filter((c) => !t.cols.includes(c))];
      const map = (tb: Table) =>
        tb.rows.map((r) =>
          cols.map((c) => {
            const i = tb.cols.indexOf(c);
            return i < 0 ? null : r[i];
          }),
        );
      return { cols, rows: [...map(t), ...map(o)] };
    }
    case 'join': {
      const o = resolve?.(s.src);
      if (!o) throw new Error(`Source "${s.src}" not found`);
      need(t, s.left);
      need(o, s.right);
      const li = ci(s.left),
        ri = o.cols.indexOf(s.right);
      const extra = o.cols.map((c, i) => ({ c, i })).filter((x) => x.i !== ri);
      const names = extra.map((x) => (t.cols.includes(x.c) ? `${x.c}.1` : x.c));
      const idx = new Map<string, Cell[][]>();
      for (const r of o.rows) {
        const k = String(r[ri] ?? '').toLowerCase();
        if (!idx.has(k)) idx.set(k, []);
        idx.get(k)!.push(r);
      }
      const out: Cell[][] = [];
      for (const r of t.rows) {
        const m = idx.get(String(r[li] ?? '').toLowerCase());
        if (m) m.forEach((x) => out.push([...r, ...extra.map((e) => x[e.i])]));
        else if (s.kind === 'left') out.push([...r, ...extra.map(() => null)]);
      }
      return { cols: [...t.cols, ...names], rows: out };
    }
  }
}
export function runQuery(
  base: Table,
  steps: Step[],
  resolve?: Resolver,
): { table: Table; error?: string; failedAt?: number } {
  let t = base;
  for (let i = 0; i < steps.length; i++) {
    try {
      t = applyStep(t, steps[i], resolve);
    } catch (e) {
      return { table: t, error: `Step ${i + 1} (${describeStep(steps[i])}): ${(e as Error).message}`, failedAt: i };
    }
  }
  return { table: t };
}

/* ---------- import ---------- */
export function parseDelimited(text: string, delim?: string): Cell[][] {
  const t = text.replace(/^﻿/, '');
  const d =
    delim ??
    (t.split('\n', 1)[0].includes('\t')
      ? '\t'
      : t.split('\n', 1)[0].includes(';') && !t.split('\n', 1)[0].includes(',')
        ? ';'
        : ',');
  const rows: string[][] = [];
  let row: string[] = [],
    cur = '',
    q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"' && cur === '') q = true;
    else if (ch === d) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows
    .filter((r) => r.length > 1 || r[0] !== '')
    .map((r) =>
      r.map((v) =>
        v === '' ? null : toNum(v) !== null && !/^0\d/.test(v.trim()) && v.trim() === String(toNum(v)) ? toNum(v) : v,
      ),
    );
}
export function tableFromGrid(grid: Cell[][], header = true): Table {
  if (!grid.length) return { cols: [], rows: [] };
  const n = maxOf(grid.map((r) => r.length));
  const seen = new Map<string, number>();
  const head = header
    ? Array.from({ length: n }, (_, i) => (blank(grid[0][i]) ? `Column${i + 1}` : String(grid[0][i]).trim()))
    : Array.from({ length: n }, (_, i) => `Column${i + 1}`);
  const cols = head.map((h) => {
    const k = h.toLowerCase();
    const c = seen.get(k) ?? 0;
    seen.set(k, c + 1);
    return c ? `${h}.${c}` : h;
  });
  return { cols, rows: (header ? grid.slice(1) : grid).map((r) => Array.from({ length: n }, (_, i) => r[i] ?? null)) };
}
export function tableFromJson(text: string): Table {
  const data = JSON.parse(text);
  const arr: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((Object.values(data).find(Array.isArray) as unknown[] | undefined) ?? [data])
      : [];
  if (arr.length && Array.isArray(arr[0])) return tableFromGrid(arr as Cell[][], true);
  const flat = (o: unknown, pre = '', out: Record<string, Cell> = {}): Record<string, Cell> => {
    if (o && typeof o === 'object' && !Array.isArray(o))
      for (const [k, v] of Object.entries(o)) flat(v, pre ? `${pre}.${k}` : k, out);
    else out[pre || 'value'] = Array.isArray(o) ? JSON.stringify(o) : (o as Cell);
    return out;
  };
  const recs = arr.map((x) => flat(x));
  const cols = [...new Set(recs.flatMap((r) => Object.keys(r)))];
  return { cols, rows: recs.map((r) => cols.map((c) => (r[c] === undefined ? null : r[c]))) };
}

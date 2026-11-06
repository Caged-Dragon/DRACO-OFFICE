// Excel-style Tables (v1.2.0): pure model + structured-reference resolver. No DOM, no engine.
export interface Table {
  id: string; name: string; sheet: string;
  r0: number; c0: number; r1: number; c1: number; // r0 = header row, r1 = last row (incl. total row when totalRow)
  headers: string[]; style: number; banded: boolean; totalRow: boolean; filter: boolean;
  totals: Record<number, TotalFn>; // column offset -> function
}
export type TotalFn = 'none' | 'sum' | 'average' | 'count' | 'countnums' | 'min' | 'max' | 'stdev' | 'var';
export const TOTAL_FNS: Array<[TotalFn, string, number | null]> = [['none', 'None', null], ['average', 'Average', 101], ['count', 'Count', 103], ['countnums', 'Count Numbers', 102], ['max', 'Max', 104], ['min', 'Min', 105], ['sum', 'Sum', 109], ['stdev', 'StdDev', 107], ['var', 'Var', 110]];
export const colName = (n: number) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export const a1 = (r: number, c: number, abs = true) => (abs ? `$${colName(c)}$${r + 1}` : `${colName(c)}${r + 1}`);
const qs = (n: string) => (/^[A-Za-z0-9_]+$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
export const dataRows = (t: Table) => ({ first: t.r0 + 1, last: t.totalRow ? t.r1 - 1 : t.r1 });
export const inTable = (t: Table, sheet: string, r: number, c: number) => t.sheet === sheet && r >= t.r0 && r <= t.r1 && c >= t.c0 && c <= t.c1;

const RESERVED = /^(?:[A-Za-z]{1,3}\d+|R\d*C\d*|[RC])$/i;
export function validateTableName(name: string, tables: Table[], editingId?: string, definedNames: string[] = []): string | null {
  if (!name.trim()) return 'Enter a table name.';
  if (!/^[A-Za-z_\\][A-Za-z0-9_.]*$/.test(name)) return 'Use letters, numbers, underscores and dots; start with a letter or underscore.';
  if (RESERVED.test(name)) return `"${name}" looks like a cell reference — choose another name.`;
  if (name.length > 255) return 'That name is too long.';
  const l = name.toLowerCase();
  if (tables.some((t) => t.id !== editingId && t.name.toLowerCase() === l)) return `A table named "${name}" already exists.`;
  if (definedNames.some((n) => n.toLowerCase() === l)) return `"${name}" is already used as a defined name.`;
  return null;
}
export function nextTableName(tables: Table[]): string { let i = 1; while (tables.some((t) => t.name.toLowerCase() === `table${i}`)) i++; return `Table${i}`; }
/** Make header strings unique and non-empty the way Excel does (Column1, Name2…). */
export function cleanHeaders(raw: Array<string | number | boolean | null | undefined>): string[] {
  const seen = new Set<string>(); return raw.map((v, i) => { let h = v === null || v === undefined || v === '' ? `Column${i + 1}` : String(v); if (seen.has(h.toLowerCase())) { let k = 2; while (seen.has(`${h}${k}`.toLowerCase())) k++; h = `${h}${k}`; } seen.add(h.toLowerCase()); return h; });
}

/* ---------- structured references ---------- */
const colIndex = (t: Table, name: string) => t.headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
const unesc = (s: string) => s.replace(/'([\[\]#'@])/g, '$1');
export function parseSpecifiers(spec: string): string[] | null {
  // spec is the text INSIDE the outer brackets: "Sales", "@Sales", "@[Sales Amt]", "[#Headers],[Sales]", "[Sales]:[Cost]", "#Totals"
  const out: string[] = []; let i = 0; const s = spec.trim();
  while (i < s.length) {
    if (s[i] === ',' || s[i] === ' ') { i++; continue; }
    if (s[i] === ':') { out.push(':'); i++; continue; }
    if (s[i] === '[') { let d = 1, j = i + 1, buf = ''; while (j < s.length && d) { if (s[j] === "'" && j + 1 < s.length) { buf += s[j] + s[j + 1]; j += 2; continue; } if (s[j] === '[') d++; else if (s[j] === ']') { d--; if (!d) break; } buf += s[j]; j++; } if (d) return null; out.push(buf); i = j + 1; continue; }
    let j = i, buf = ''; while (j < s.length && s[j] !== ',' && s[j] !== ':') { if (s[j] === "'" && j + 1 < s.length) { buf += s[j] + s[j + 1]; j += 2; continue; } buf += s[j]; j++; } out.push(buf.trim()); i = j;
  }
  return out;
}
export type RefResult = { ok: true; ref: string } | { ok: false; error: string };
/** Resolve the inside of Table[...] to an A1 reference (sheet-qualified). `row` is the formula's own row for [@Col]. */
export function resolveSpec(t: Table, spec: string, row: number | null, fromSheet?: string): RefResult {
  const parts = parseSpecifiers(spec); if (!parts || !parts.length) return { ok: false, error: `Can't read "[${spec}]".` };
  const { first, last } = dataRows(t); let r0 = first, r1 = last; let cols: [number, number] | null = null; let items = false; let thisRow = false; let i = 0; const sheetPrefix = fromSheet === t.sheet ? '' : `${qs(t.sheet)}!`;
  const wholeCol = (txt: string) => unesc(txt.startsWith('[') && txt.endsWith(']') ? txt.slice(1, -1) : txt);
  while (i < parts.length) {
    const p = parts[i]; const low = p.toLowerCase();
    if (p === ':') { i++; continue; }
    if (low === '#all') { r0 = t.r0; r1 = t.r1; items = true; }
    else if (low === '#data') { r0 = first; r1 = last; items = true; }
    else if (low === '#headers') { r0 = t.r0; r1 = t.r0; items = true; }
    else if (low === '#totals') { if (!t.totalRow) return { ok: false, error: `${t.name} has no total row.` }; r0 = t.r1; r1 = t.r1; items = true; }
    else if (low === '#this row' || p.startsWith('@')) { thisRow = true; items = true; const rest = low === '#this row' ? '' : p.slice(1); if (rest) { const nm = wholeCol(rest.startsWith('[') ? rest : rest); const ci = colIndex(t, nm); if (ci < 0) return { ok: false, error: `${t.name} has no column "${nm}".` }; cols = [ci, ci]; } }
    else { const nm = wholeCol(p); const ci = colIndex(t, nm); if (ci < 0) return { ok: false, error: `${t.name} has no column "${nm}".` };
      if (parts[i + 1] === ':' && parts[i + 2] !== undefined) { const nm2 = wholeCol(parts[i + 2]); const cj = colIndex(t, nm2); if (cj < 0) return { ok: false, error: `${t.name} has no column "${nm2}".` }; cols = [Math.min(ci, cj), Math.max(ci, cj)]; i += 2; } else cols = cols ? [Math.min(cols[0], ci), Math.max(cols[1], ci)] : [ci, ci]; }
    i++;
  }
  if (thisRow) { if (row === null || row < first || row > last) return { ok: false, error: `[@] can only be used on a data row of ${t.name}.` }; r0 = r1 = row; }
  void items; const [ca, cb] = cols ?? [0, t.headers.length - 1];
  const A = a1(r0, t.c0 + ca), B = a1(r1, t.c0 + cb); return { ok: true, ref: A === B ? `${sheetPrefix}${A}` : `${sheetPrefix}${A}:${B}` };
}
/** Rewrite every structured reference in `formula` to plain A1. `home` locates the formula so `[@Col]` / `[Col]` inside the table work. */
export function resolveFormula(formula: string, tables: Table[], home: { sheet: string; row: number; col: number }): { formula: string; error?: string; used: boolean } {
  if (!formula.startsWith('=')) return { formula, used: false };
  const lf = formula.toLowerCase(); if (!lf.includes('[') && !tables.some((t) => lf.includes(t.name.toLowerCase()))) return { formula, used: false };
  const parts = formula.split(/("(?:[^"]|"")*")/); let error: string | undefined; let used = false;
  const homeTable = tables.find((t) => inTable(t, home.sheet, home.row, home.col)) ?? null;
  const readBracket = (s: string, at: number): { inner: string; end: number } | null => { let d = 0, j = at; for (; j < s.length; j++) { if (s[j] === "'" && j + 1 < s.length) { j++; continue; } if (s[j] === '[') d++; else if (s[j] === ']') { d--; if (!d) return { inner: s.slice(at + 1, j), end: j + 1 }; } } return null; };
  const out = parts.map((seg, k) => {
    if (k % 2) return seg; let res = '', i = 0;
    while (i < seg.length) {
      const m = /^([A-Za-z_\\][A-Za-z0-9_.]*)?\[/.exec(seg.slice(i));
      const prevCh = i > 0 ? seg[i - 1] : ''; const wordStart = !/[A-Za-z0-9_.!'$]/.test(prevCh);
      if (!m || !wordStart) { res += seg[i]; i++; continue; }
      const name = m[1]; const b = readBracket(seg, i + (name ? name.length : 0)); if (!b) { res += seg[i]; i++; continue; }
      let t: Table | null = null; if (name) { t = tables.find((x) => x.name.toLowerCase() === name.toLowerCase()) ?? null; if (!t) { res += seg[i]; i++; continue; } } else t = homeTable;
      if (!t) { error ??= `Can't use [${b.inner}] outside a table.`; res += seg.slice(i, b.end); i = b.end; continue; }
      const inner = !name && !b.inner.startsWith('@') && !b.inner.startsWith('#') && !b.inner.startsWith('[') ? `@${b.inner}` : b.inner; // [Col] inside a table = this row
      const r = resolveSpec(t, name ? b.inner : inner, home.row, home.sheet); if (r.ok) { res += r.ref; used = true; } else { error ??= r.error; res += seg.slice(i, b.end); } i = b.end;
    }
    // bare Table1 (whole data body) — only when followed by a non-word char and the name is a known table
    return res.replace(/(^|[^A-Za-z0-9_.!'$\[])([A-Za-z_\\][A-Za-z0-9_.]*)(?![A-Za-z0-9_.(\[!])/g, (m0, pre: string, nm: string) => { const t = tables.find((x) => x.name.toLowerCase() === nm.toLowerCase()); if (!t) return m0; const { first, last } = dataRows(t); used = true; return `${pre}${t.sheet === home.sheet ? '' : qs(t.sheet) + '!'}${a1(first, t.c0)}:${a1(last, t.c1)}`; });
  });
  return { formula: out.join(''), error, used };
}

/* ---------- geometry operations ---------- */
export function expandDown(t: Table, rows = 1): Table { return { ...t, r1: t.r1 + rows }; }
/** True when (r,c) sits directly under the table's last data row (or total row is absent) and inside its columns: typing there grows the table. */
export function growsTable(t: Table, sheet: string, r: number, c: number): boolean { return t.sheet === sheet && !t.totalRow && r === t.r1 + 1 && c >= t.c0 && c <= t.c1; }
export function growsRight(t: Table, sheet: string, r: number, c: number): boolean { return t.sheet === sheet && r === t.r0 && c === t.c1 + 1; }
export function toggleTotals(t: Table, on: boolean): Table { if (on === t.totalRow) return t; return on ? { ...t, totalRow: true, r1: t.r1 + 1 } : { ...t, totalRow: false, r1: t.r1 - 1, totals: {} }; }
export const overlaps = (a: Table, r0: number, c0: number, r1: number, c1: number, sheet: string) => a.sheet === sheet && !(r1 < a.r0 || r0 > a.r1 || c1 < a.c0 || c0 > a.c1);
/** Formula text for a total-row cell, in structured form. */
export function totalFormula(t: Table, colOffset: number, fn: TotalFn): string | null { const code = TOTAL_FNS.find((x) => x[0] === fn)?.[2]; if (!code) return null; return `=SUBTOTAL(${code},${t.name}[${t.headers[colOffset].replace(/([\[\]#'])/g, "'$1")}])`; }
/** Detect a header row + data block starting at (r,c) given a value grid (first row text). */
export function looksLikeHeaders(row: unknown[]): boolean { return row.length > 0 && row.every((v) => typeof v === 'string' && v.trim() !== '') ; }

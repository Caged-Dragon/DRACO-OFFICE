// Engine glue for Excel-style Tables (v1.2.0): registry persisted in the workbook, structured references, auto-expand,
// total row, styles, header rename, table slicers.
import type { Engine } from '../engine';
import { targetLoc, type Out } from '../dataGlue';
import { TABLE_STYLES, tablePlan } from '../dataTools';
import { registerResource, addResources, loadResources } from '../persist';
import { replaceFloat, type WS } from '../charts/chartGlue';
import { SLICER_KEY } from '../objects/keys';
import * as M from './tableModel';

interface SlicerDef { id: string; tableId: string; col: number }
let tables: M.Table[] = [];
let formulas: Record<string, string> = {}; // "sheet|row|col" -> original structured formula
let slicerEx: Record<string, string[]> = {}; // "tableId|col" -> excluded labels
let slicers: SlicerDef[] = [];
let busy = false;
registerResource('draco.tables', { get: () => (tables.length ? { tables, formulas, slicerEx, slicers } : null), set: (v) => { const o = v as { tables?: M.Table[]; formulas?: typeof formulas; slicerEx?: typeof slicerEx; slicers?: SlicerDef[] }; tables = o.tables ?? []; formulas = o.formulas ?? {}; slicerEx = o.slicerEx ?? {}; slicers = o.slicers ?? []; }, reset: () => { tables = []; formulas = {}; slicerEx = {}; slicers = []; } });

const ok = (message: string): Out => ({ ok: true, message }); const fail = (message: string): Out => ({ ok: false, message });
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
const key = (s: string, r: number, c: number) => `${s}|${r}|${c}`;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
export const listTables = () => tables.map((t) => ({ ...t }));
export const getTable = (idOrName: string) => tables.find((t) => t.id === idOrName || t.name.toLowerCase() === idOrName.toLowerCase());
const sheetOf = (e: Engine, name: string) => wbOf(e)?.getSheetByName(name) ?? null;
const definedNames = (e: Engine) => (wbOf(e)?.getDefinedNames() ?? []).map((n) => n.getName());

/** Re-resolve every stored structured formula against the current table geometry. */
export function refreshFormulas(e: Engine): number {
  const wb = wbOf(e); if (!wb) return 0; let n = 0; busy = true;
  try { for (const [k, f] of Object.entries(formulas)) { const [sh, r, c] = k.split('|'); const ws = wb.getSheetByName(sh); if (!ws) { delete formulas[k]; continue; }
    const res = M.resolveFormula(f, tables, { sheet: sh, row: +r, col: +c }); if (!res.used) { delete formulas[k]; continue; }
    if (res.error) continue; const cell = ws.getRange(+r, +c); if (cell.getFormula() !== res.formula) { cell.setFormula(res.formula); n++; } } } finally { busy = false; }
  return n;
}
function format(e: Engine, t: M.Table) {
  const ws = sheetOf(e, t.sheet); if (!ws) return; const st = TABLE_STYLES[t.style] ?? TABLE_STYLES[0]; const rows = t.r1 - t.r0 + 1; const plan = tablePlan(rows, st, { banded: t.banded, totalRow: t.totalRow });
  plan.forEach((p, i) => ws.getRange(t.r0 + i, t.c0, 1, t.c1 - t.c0 + 1).setBackground(p.bg).setFontColor(p.fg ?? '#000000').setFontWeight(p.bold ? 'bold' : 'normal'));
  const all = ws.getRange(t.r0, t.c0, rows, t.c1 - t.c0 + 1); all.setBorder(e.api.Enum.BorderType.OUTSIDE, e.api.Enum.BorderStyleTypes.THIN, st.border);
  ws.getRange(t.r0, t.c0, 1, t.c1 - t.c0 + 1).setBorder(e.api.Enum.BorderType.BOTTOM, e.api.Enum.BorderStyleTypes.MEDIUM, st.border);
}
function applyFilter(e: Engine, t: M.Table) { const ws = sheetOf(e, t.sheet); if (!ws) return; try { const cur = ws.getFilter(); if (t.filter && !cur) ws.getRange(t.r0, t.c0, Math.max(1, M.dataRows(t).last - t.r0 + 1), t.c1 - t.c0 + 1).createFilter(); else if (!t.filter && cur) cur.remove(); } catch { /* one filter per sheet */ } }

export interface CreateOpts { name?: string; style?: number; banded?: boolean; totalRow?: boolean; filter?: boolean; hasHeaders?: boolean; ref?: string }
export function createTable(e: Engine, o: CreateOpts = {}): Out & { table?: M.Table } {
  const l = targetLoc(e); if (!l) return fail('Select the data you want in the table.');
  const sheet = l.sheet.getSheetName(); let r0 = l.r0; let rows = l.rows; const c0 = l.c0, cols = l.cols;
  if (rows < 1 || cols < 1) return fail('Select the data you want in the table.');
  if (tables.some((t) => M.overlaps(t, r0, c0, r0 + rows - 1, c0 + cols - 1, sheet))) return fail('That range overlaps an existing table.');
  const name = o.name?.trim() || M.nextTableName(tables); const bad = M.validateTableName(name, tables, undefined, definedNames(e)); if (bad) return fail(bad);
  const hasHeaders = o.hasHeaders ?? true;
  if (!hasHeaders) { (l.sheet as unknown as { insertRowBefore(n: number): unknown }).insertRowBefore(r0); rows += 1; }
  else if (rows < 2) return fail('A table needs a header row and at least one data row.');
  const hdrCells = l.sheet.getRange(r0, c0, 1, cols); const raw = hasHeaders ? (hdrCells.getValues()[0] as Array<string | number | null>) : Array(cols).fill('');
  const headers = M.cleanHeaders(raw); hdrCells.setValues([headers]);
  const t: M.Table = { id: uid('tbl'), name, sheet, r0, c0, r1: r0 + rows - 1, c1: c0 + cols - 1, headers, style: o.style ?? 0, banded: o.banded ?? true, totalRow: false, filter: o.filter ?? true, totals: {} };
  tables.push(t); format(e, t); applyFilter(e, t);
  if (o.totalRow) setTotalRow(e, t.id, true);
  return { ...ok(`Created ${name} (${rows - 1} data row${rows === 2 ? '' : 's'}, ${cols} column${cols === 1 ? '' : 's'}).`), table: getTable(t.id) };
}
export function setTotalRow(e: Engine, id: string, on: boolean): Out {
  const t = getTable(id); if (!t) return fail('Table not found.'); const ws = sheetOf(e, t.sheet); if (!ws) return fail('Sheet missing.'); if (t.totalRow === on) return ok('No change.');
  if (on) { (ws as unknown as { insertRowBefore(n: number): unknown }).insertRowBefore(t.r1 + 1); Object.assign(t, M.toggleTotals(t, true)); const first = ws.getRange(t.r1, t.c0); first.setValue('Total'); for (let i = 1; i < t.headers.length; i++) { const num = columnHasNumbers(e, t, i); if (num) setTotalFn(e, t.id, i, 'sum'); } }
  else { ws.getRange(t.r1, t.c0, 1, t.c1 - t.c0 + 1).clearContent(); for (let i = 0; i < t.headers.length; i++) delete formulas[key(t.sheet, t.r1, t.c0 + i)]; Object.assign(t, M.toggleTotals(t, false)); ws.getRange(t.r1 + 1, t.c0, 1, t.c1 - t.c0 + 1).setBackground('#ffffff').setFontWeight('normal'); }
  format(e, t); refreshFormulas(e); return ok(on ? 'Total row added.' : 'Total row removed.');
}
function columnHasNumbers(e: Engine, t: M.Table, off: number) { const ws = sheetOf(e, t.sheet); if (!ws) return false; const { first, last } = M.dataRows(t); const v = ws.getRange(first, t.c0 + off, Math.max(1, last - first + 1), 1).getValues().flat(); return v.some((x) => typeof x === 'number'); }
export function setTotalFn(e: Engine, id: string, colOffset: number, fn: M.TotalFn): Out {
  const t = getTable(id); if (!t || !t.totalRow) return fail('Turn on the total row first.'); const ws = sheetOf(e, t.sheet); if (!ws) return fail('Sheet missing.'); const cell = ws.getRange(t.r1, t.c0 + colOffset); const f = M.totalFormula(t, colOffset, fn);
  if (!f) { cell.clearContent(); delete formulas[key(t.sheet, t.r1, t.c0 + colOffset)]; delete t.totals[colOffset]; return ok('Cleared.'); }
  t.totals[colOffset] = fn; formulas[key(t.sheet, t.r1, t.c0 + colOffset)] = f; busy = true; try { const r = M.resolveFormula(f, tables, { sheet: t.sheet, row: t.r1, col: t.c0 + colOffset }); cell.setFormula(r.formula); } finally { busy = false; } return ok('Total set.');
}
/** Called after the user finishes editing a cell. Handles header rename, auto-expand (+calculated columns) and structured formulas. */
export function onEdit(e: Engine, sheet: string, row: number, col: number): string | null {
  if (busy) return null; const ws = sheetOf(e, sheet); if (!ws) return null; let msg: string | null = null;
  // header rename
  const th = tables.find((t) => t.sheet === sheet && row === t.r0 && col >= t.c0 && col <= t.c1);
  if (th) { const off = col - th.c0; const raw = ws.getRange(row, col).getValue(); const old = th.headers[off]; const want = String(raw ?? '').trim(); if (want && want !== old) { const others = th.headers.filter((_, i) => i !== off).map((h) => h.toLowerCase()); const nu = others.includes(want.toLowerCase()) ? `${want}2` : want; if (nu !== want) ws.getRange(row, col).setValue(nu); th.headers[off] = nu; renameInFormulas(old, nu, th.name); refreshFormulas(e); msg = `Column renamed to "${nu}".`; } else if (!want) ws.getRange(row, col).setValue(old); }
  // grow right: header typed just right of the table
  const tr = tables.find((t) => M.growsRight(t, sheet, row, col)); if (tr && String(ws.getRange(row, col).getValue() ?? '').trim()) { tr.c1 += 1; tr.headers.push(M.cleanHeaders([...tr.headers, String(ws.getRange(row, col).getValue())]).pop()!); format(e, tr); refreshFormulas(e); msg = `${tr.name} grew by one column.`; }
  // auto-expand down
  const tg = tables.find((t) => M.growsTable(t, sheet, row, col)); if (tg) { const prev = tg.r1; Object.assign(tg, M.expandDown(tg, 1)); for (let i = 0; i <= tg.c1 - tg.c0; i++) { const above = formulas[key(sheet, prev, tg.c0 + i)]; const cell = ws.getRange(tg.r1, tg.c0 + i); if (above && /\[@|\[\w/.test(above) && !above.includes('#Totals') && cell.getFormula() === '' && tg.c0 + i !== col) { formulas[key(sheet, tg.r1, tg.c0 + i)] = above; } } format(e, tg); refreshFormulas(e); msg = `${tg.name} expanded to row ${tg.r1 + 1}.`; }
  // structured references typed into this cell
  const cell = ws.getRange(row, col); const f = cell.getFormula();
  if (f && f.startsWith('=')) { const res = M.resolveFormula(f, tables, { sheet, row, col }); if (res.used && !res.error) { formulas[key(sheet, row, col)] = f; busy = true; try { cell.setFormula(res.formula); } finally { busy = false; }
      // calculated column: a row-relative formula entered in a data row fills the empty cells of that column
      const tc = tableAt(sheet, row, col); if (tc && /\[@|^=[^"]*(?<![A-Za-z0-9_.])\[[A-Za-z]/.test(f) && !tc.totalRow || (tc && /\[@/.test(f))) { const { first, last } = M.dataRows(tc!); if (row >= first && row <= last) { let n = 0; for (let r2 = first; r2 <= last; r2++) { if (r2 === row) continue; const c2 = ws.getRange(r2, col); if (c2.getFormula() === '' && (c2.getValue() === null || c2.getValue() === '')) { formulas[key(sheet, r2, col)] = f; n++; } } if (n) { refreshFormulas(e); msg = `Calculated column: filled ${n} more row${n === 1 ? '' : 's'}.`; } } } } else if (res.error) msg = res.error; else delete formulas[key(sheet, row, col)]; }
  else delete formulas[key(sheet, row, col)];
  return msg;
}
function renameInFormulas(oldH: string, newH: string, tableName: string) {
  const esc = (s: string) => s.replace(/([\[\]#'])/g, "'$1"); const o = esc(oldH), n = esc(newH);
  for (const k of Object.keys(formulas)) { let f = formulas[k]; f = f.split(`[${o}]`).join(`[${n}]`).split(`[@${o}]`).join(`[@${n}]`).split(`[@[${o}]]`).join(`[@[${n}]]`); formulas[k] = f; }
  void tableName;
}
export function renameTable(e: Engine, id: string, name: string): Out {
  const t = getTable(id); if (!t) return fail('Table not found.'); const bad = M.validateTableName(name, tables, t.id, definedNames(e)); if (bad) return fail(bad);
  const old = t.name; for (const k of Object.keys(formulas)) formulas[k] = formulas[k].replace(new RegExp(`(^|[^A-Za-z0-9_.!'$])${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\[|[^A-Za-z0-9_.(\\[!])`, 'gi'), `$1${name}`);
  t.name = name; refreshFormulas(e); return ok(`Renamed to ${name}.`);
}
export function updateTable(e: Engine, id: string, p: Partial<Pick<M.Table, 'style' | 'banded' | 'filter'>>): Out {
  const t = getTable(id); if (!t) return fail('Table not found.'); Object.assign(t, p); format(e, t); if ('filter' in p) applyFilter(e, t); return ok('Table updated.');
}
export function resizeTable(e: Engine, id: string, ref: string): Out {
  const t = getTable(id); if (!t) return fail('Table not found.'); const ws = sheetOf(e, t.sheet); if (!ws) return fail('Sheet missing.');
  let rg; try { rg = ws.getRange(ref); } catch { return fail(`Can't read "${ref}".`); } const a = rg.getRange(); const r0 = a.startRow, c0 = a.startColumn, r1 = a.endRow, c1 = a.endColumn;
  if (r0 !== t.r0) return fail('The header row must stay the same.'); if (c1 < c0 || r1 <= r0) return fail('A table needs a header row and at least one data row.');
  if (tables.some((x) => x.id !== t.id && M.overlaps(x, r0, c0, r1, c1, t.sheet))) return fail('That range overlaps another table.');
  const hdr = M.cleanHeaders(ws.getRange(r0, c0, 1, c1 - c0 + 1).getValues()[0] as string[]); ws.getRange(r0, c0, 1, hdr.length).setValues([hdr]);
  Object.assign(t, { r0, c0, r1, c1, headers: hdr, totalRow: false, totals: {} }); format(e, t); refreshFormulas(e); return ok(`Resized to ${r1 - r0} data rows × ${hdr.length} columns.`);
}
/** Convert to a normal range: keep formatting and the (already resolved) A1 formulas. */
export function convertToRange(e: Engine, id: string): Out {
  const t = getTable(id); if (!t) return fail('Table not found.'); for (const k of Object.keys(formulas)) { const [sh, r, c] = k.split('|'); if (M.inTable(t, sh, +r, +c)) delete formulas[k]; }
  for (const s of slicers.filter((x) => x.tableId === t.id)) removeSlicer(e, s.id); for (const k of Object.keys(slicerEx)) if (k.startsWith(t.id + '|')) delete slicerEx[k];
  showAllRows(e, t); const name = t.name; tables = tables.filter((x) => x.id !== t.id); refreshFormulas(e); return ok(`${name} converted to a normal range.`);
}
export function tableAt(sheet: string, row: number, col: number) { return tables.find((t) => M.inTable(t, sheet, row, col)) ?? null; }

/* ---------- table slicers (v1.2.0) ---------- */
function itemsOf(e: Engine, t: M.Table, col: number): Array<{ label: string; on: boolean }> {
  const ws = sheetOf(e, t.sheet); if (!ws) return []; const { first, last } = M.dataRows(t); const vals = ws.getRange(first, t.c0 + col, Math.max(1, last - first + 1), 1).getDisplayValues?.().flat() ?? ws.getRange(first, t.c0 + col, Math.max(1, last - first + 1), 1).getValues().flat().map(String);
  const ex = new Set(slicerEx[`${t.id}|${col}`] ?? []); return [...new Set(vals.map((v) => String(v ?? '')))].filter((v) => v !== '').sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((label) => ({ label, on: !ex.has(label) }));
}
function pushSlicer(e: Engine, s: SlicerDef) { const t = getTable(s.tableId); const ws = t && sheetOf(e, t.sheet) as unknown as WS | null; if (!t || !ws) return; const f = ws.getFloatDomById(s.id); if (!f) return; replaceFloat(ws, s.id, SLICER_KEY, { pivotId: t.id, field: t.headers[s.col], title: t.headers[s.col], items: itemsOf(e, t, s.col) }, (f as unknown as { position: never }).position); }
function applyRowVisibility(e: Engine, t: M.Table) {
  const ws = sheetOf(e, t.sheet); if (!ws) return; const { first, last } = M.dataRows(t); const n = last - first + 1; if (n < 1) return;
  const cols = Object.keys(slicerEx).filter((k) => k.startsWith(t.id + '|') && slicerEx[k].length).map((k) => ({ col: +k.split('|')[1], ex: new Set(slicerEx[k]) }));
  const vals = ws.getRange(first, t.c0, n, t.c1 - t.c0 + 1).getValues(); ws.showRows(first, n);
  let run = -1; const flush = (end: number) => { if (run >= 0) { ws.hideRows(first + run, end - run); run = -1; } };
  for (let i = 0; i < n; i++) { const hide = cols.some((c) => c.ex.has(String(vals[i][c.col] ?? ''))); if (hide && run < 0) run = i; if (!hide) flush(i); } flush(n);
}
function showAllRows(e: Engine, t: M.Table) { const ws = sheetOf(e, t.sheet); const { first, last } = M.dataRows(t); if (ws && last >= first) ws.showRows(first, last - first + 1); }
export function addTableSlicer(e: Engine, tableId: string, column: string): Out & { id?: string } {
  const t = getTable(tableId); if (!t) return fail('Table not found.'); const col = t.headers.findIndex((h) => h.toLowerCase() === column.toLowerCase()); if (col < 0) return fail(`${t.name} has no column "${column}".`);
  if (slicers.some((s) => s.tableId === t.id && s.col === col)) return fail(`There is already a slicer for ${t.headers[col]}.`);
  const ws = sheetOf(e, t.sheet) as unknown as WS | null; if (!ws) return fail('Sheet missing.'); const items = itemsOf(e, t, col); const n = slicers.filter((s) => s.tableId === t.id).length; const id = uid('tslicer');
  const at = ws.getRange(t.r0, t.c1 + 2 + n * 3, 1, 1); const r = ws.addFloatDomToRange(at, { componentKey: SLICER_KEY, data: { pivotId: t.id, field: t.headers[col], title: t.headers[col], items } as never, allowTransform: false }, { width: 170, height: Math.min(320, 64 + items.length * 34), marginX: 4, marginY: 4 }, id);
  if (!r) return fail('The engine could not place the slicer.'); slicers.push({ id, tableId: t.id, col }); return { ...ok(`Slicer for ${t.headers[col]} added.`), id };
}
export function removeSlicer(e: Engine, id: string): Out { const s = slicers.find((x) => x.id === id); if (!s) return fail('Slicer not found.'); const t = getTable(s.tableId); const wb = wbOf(e); for (const w of wb?.getSheets() ?? []) if (w.getFloatDomById(id)) { w.removeFloatDom(id); break; } delete slicerEx[`${s.tableId}|${s.col}`]; slicers = slicers.filter((x) => x.id !== id); if (t) applyRowVisibility(e, t); return ok('Slicer removed.'); }
export const isTableId = (id: string) => id.startsWith('tbl_');
export function slicerClick(e: Engine, tableId: string, field: string, label: string, multi: boolean): Out {
  const t = getTable(tableId); if (!t) return fail('Table not found.'); const col = t.headers.indexOf(field); if (col < 0) return fail('Column not found.'); const all = itemsOf(e, t, col).map((i) => i.label); const k = `${t.id}|${col}`; const cur = new Set(slicerEx[k] ?? []); let next: Set<string>;
  if (label === '*') next = new Set(); else if (multi) { next = new Set(cur); next.has(label) ? next.delete(label) : next.add(label); if (next.size === all.length) next = new Set(); } else next = new Set(all.filter((x) => x !== label));
  slicerEx[k] = [...next]; applyRowVisibility(e, t); for (const s of slicers.filter((x) => x.tableId === t.id)) pushSlicer(e, s); return ok('Filtered.');
}
export function transformSlicer(e: Engine, tableId: string, field: string, dx: number, dy: number, dw: number, dh: number): Out & { box?: { left: number; top: number; width: number; height: number } } {
  const t = getTable(tableId); const s = t && slicers.find((x) => x.tableId === t.id && t.headers[x.col] === field); if (!t || !s) return fail('Slicer not found.'); const ws = sheetOf(e, t.sheet) as unknown as WS | null; const f = ws?.getFloatDomById(s.id) as unknown as { data: unknown; position: { left?: number; top?: number; width?: number; height?: number } } | null; if (!ws || !f) return fail('Slicer not on the sheet.');
  const p = f.position; const box = { left: Math.max(0, Math.round((p.left ?? 0) + dx)), top: Math.max(0, Math.round((p.top ?? 0) + dy)), width: Math.max(110, Math.round((p.width ?? 170) + dw)), height: Math.max(80, Math.round((p.height ?? 100) + dh)) };
  return replaceFloat(ws, s.id, SLICER_KEY, f.data, box) ? { ...ok('Moved'), box } : fail('The engine could not move the slicer.');
}
export const listSlicers = () => slicers.map((s) => ({ ...s, table: getTable(s.tableId)?.name ?? '', column: getTable(s.tableId)?.headers[s.col] ?? '' }));
/** After a reload the slicer floats are in the file but their rows/labels may be stale. */
export function ensureTables(e: Engine): void { for (const t of tables) if (t.needsFormat) { format(e, t); delete t.needsFormat; } refreshFormulas(e); for (const s of slicers) pushSlicer(e, s); }
export function install(w: Record<string, unknown>, e: () => Engine) {
  w.dracoTables = { saveLoad: (reload: boolean) => { const snap: { resources?: Array<{ name: string; data: string }> } = {}; addResources(snap); const res = snap.resources ?? []; if (reload) { loadResources({ resources: [] }); loadResources({ resources: res }); } return res.filter((r) => r.name === 'draco.tables').map((r) => r.data.length); }, list: listTables, create: (o?: CreateOpts) => createTable(e(), o), totalRow: (id: string, on: boolean) => setTotalRow(e(), id, on), totalFn: (id: string, c: number, fn: M.TotalFn) => setTotalFn(e(), id, c, fn), rename: (id: string, n: string) => renameTable(e(), id, n), update: (id: string, p: never) => updateTable(e(), id, p), resize: (id: string, r: string) => resizeTable(e(), id, r), toRange: (id: string) => convertToRange(e(), id), at: tableAt, refresh: () => refreshFormulas(e()), onEdit: (s: string, r: number, c: number) => onEdit(e(), s, r, c), addSlicer: (id: string, col: string) => addTableSlicer(e(), id, col), removeSlicer: (id: string) => removeSlicer(e(), id), slicers: listSlicers, click: (id: string, f: string, l: string, m: boolean) => slicerClick(e(), id, f, l, m) };
}

let lastSig = '';
/** Cheap idempotent hook for the engine's debounced refresh: re-resolve formulas / re-push slicers only when the table set changed. */
export function ensureTablesOnce(e: Engine): void { const sig = JSON.stringify(tables.map((t) => [t.id, t.name, t.r0, t.c0, t.r1, t.c1])) + slicers.length; if (sig === lastSig) return; lastSig = sig; ensureTables(e); }

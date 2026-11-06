// Engine glue for PivotTables, slicers, timelines and PivotCharts (v73-v77).
import type { Engine } from '../engine';
import { parseRef, readValues, readDisplay, type Out } from '../dataGlue';
import { a1 } from '../audit';
import { registerResource } from '../persist';
import { computePivot, defaultConfig, fieldItems, parseDateText, prepareSource, serialToDate, dateToSerial, MONTHS, type Cell, type PivotConfig, type PivotResult } from './pivot';
import { replaceFloat, CHART_KEY, pivotHook, type WS } from '../charts/chartGlue';
import { SLICER_KEY, TIMELINE_KEY, PIVOTBTN_KEY } from '../objects/keys';
import type { ChartSpec, ChartType, Series } from '../charts/render';

export interface PivotDef {
  id: string; name: string; srcSheet: string; srcRange: string; destSheet: string; anchor: string; cfg: PivotConfig;
  last?: { r0: number; c0: number; rows: number; cols: number; headRows?: number; labelCols?: number }; btns?: string[]; btnKey?: string; sig?: string; auto: boolean;
  widgets: Array<{ id: string; kind: 'slicer' | 'timeline'; field: string }>; charts: Array<{ id: string; type: ChartType }>;
}
let defs: PivotDef[] = [];
registerResource('DRACO_PIVOTS', { get: () => defs, set: (v) => { defs = Array.isArray(v) ? (v as PivotDef[]) : []; }, reset: () => { defs = []; } });
export const getPivots = () => defs;
export const getPivot = (id: string) => defs.find((d) => d.id === id) ?? null;
const ok = (message: string): Out => ({ ok: true, message }); const fail = (message: string): Out => ({ ok: false, message });
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
const qsheet = (n: string) => (/^[A-Za-z0-9_]+$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;

/** Read the source block; columns whose cells are numbers displayed as dates are flagged so date grouping works on real date cells. */
export function readSource(e: Engine, d: Pick<PivotDef, 'srcSheet' | 'srcRange'>) {
  const l = parseRef(e, `${qsheet(d.srcSheet)}!${d.srcRange}`); if (!l) return null;
  const vals = readValues(l) as Cell[][]; const disp = readDisplay(l) as string[][]; const dateCols: number[] = [];
  for (let c = 0; c < l.cols; c++) { const idx = vals.findIndex((r, i) => i > 0 && typeof r[c] === 'number'); if (idx > 0 && parseDateText(String(disp[idx]?.[c] ?? '')) !== null) dateCols.push(c); }
  return { loc: l, source: prepareSource(vals, dateCols), sig: JSON.stringify(vals) };
}
export const sourceFields = (e: Engine, srcSheet: string, srcRange: string) => { const s = readSource(e, { srcSheet, srcRange }); return s ? { fields: s.source.fields, dateFields: s.source.dateFields, rows: s.source.rows.length } : null; };
export function sourceItems(e: Engine, d: PivotDef, field: string): string[] { const s = readSource(e, d); return s ? fieldItems(s.source, field, d.cfg.bins?.[field]) : []; }

function clearRect(ws: WS, r: { r0: number; c0: number; rows: number; cols: number }) { const g = ws.getRange(r.r0, r.c0, r.rows, r.cols); g.clearContent(); g.clearFormat(); }

/** (Re)build the pivot in the sheet. */
export function buildPivot(e: Engine, def: PivotDef): Out & { result?: PivotResult } {
  const wb = wbOf(e); if (!wb) return fail('No workbook open');
  const src = readSource(e, def); if (!src) return fail(`Source range isn't valid: "${def.srcSheet}!${def.srcRange}"`);
  const dest = wb.getSheetByName(def.destSheet); if (!dest) return fail(`Destination sheet "${def.destSheet}" not found`);
  const at = parseRef(e, `${qsheet(def.destSheet)}!${def.anchor}`); if (!at) return fail(`Destination cell isn't valid: "${def.anchor}"`);
  const res = computePivot(src.source, def.cfg); if (res.error) return fail(res.error);
  const rect = { r0: at.r0, c0: at.c0, rows: res.rows, cols: res.cols };
  if (def.srcSheet === def.destSheet) { const s = src.loc; if (!(rect.r0 + rect.rows <= s.r0 || rect.r0 >= s.r0 + s.rows || rect.c0 + rect.cols <= s.c0 || rect.c0 >= s.c0 + s.cols)) return fail('The PivotTable would overlap its own source data. Choose a destination away from the source.'); }
  const old = def.last; const inOld = (r: number, c: number) => !!old && r >= old.r0 && r < old.r0 + old.rows && c >= old.c0 && c < old.c0 + old.cols;
  const cur = dest.getRange(rect.r0, rect.c0, rect.rows, rect.cols).getValues() as Cell[][];
  for (let r = 0; r < cur.length; r++) for (let c = 0; c < cur[r].length; c++) if (cur[r][c] !== null && cur[r][c] !== '' && cur[r][c] !== undefined && !inOld(rect.r0 + r, rect.c0 + c)) return fail(`The PivotTable would overwrite existing data in ${a1(rect.r0 + r, rect.c0 + c)}. Pick an empty destination.`);
  if (old) clearRect(dest, old);
  const vals = res.grid.map((row) => row.map((c) => (c.v === null || c.v === undefined ? null : typeof c.v === 'string' && c.indent ? '   '.repeat(c.indent) + c.v : c.v)));
  dest.getRange(rect.r0, rect.c0, rect.rows, rect.cols).setValues(vals as never);
  const kindOfRow = (row: typeof res.grid[number]) => (row.every((c) => c.kind === 'colhead' || c.kind === 'corner') ? 'head' : row[0]?.kind === 'total' ? 'total' : row.some((c) => c.kind === 'subtotal') ? 'sub' : 'body');
  let i = 0;
  while (i < res.grid.length) {
    const k = kindOfRow(res.grid[i]); let j = i; while (j + 1 < res.grid.length && kindOfRow(res.grid[j + 1]) === k) j++;
    if (k !== 'body') { const rg = dest.getRange(rect.r0 + i, rect.c0, j - i + 1, rect.cols); rg.setFontWeight('bold'); if (k === 'head') rg.setBackground('#DDEBF7'); else if (k === 'total') rg.setBackground('#F2F2F2'); }
    i = j + 1;
  }
  for (let c = 0; c < res.cols; c++) { const fmt = res.grid.slice(res.headRows).find((row) => row[c]?.fmt)?.[c]?.fmt; if (fmt) dest.getRange(rect.r0 + res.headRows, rect.c0 + c, Math.max(1, res.rows - res.headRows), 1).setNumberFormat(fmt); }
  for (let c = res.labelCols; c < res.cols; c++) if (res.grid.slice(res.headRows).some((row) => row[c]?.kind === 'total' && row[0]?.kind !== 'total')) dest.getRange(rect.r0 + res.headRows, rect.c0 + c, Math.max(1, res.rows - res.headRows), 1).setFontWeight('bold');
  def.last = { ...rect, headRows: res.headRows, labelCols: res.labelCols }; def.sig = src.sig; placeFieldButtons(e, def);
  updateWidgets(e, def, src.source); updatePivotCharts(e, def, res);
  return { ...ok(`PivotTable built: ${res.rows - res.headRows} rows × ${res.cols} columns from ${res.recordCount} records`), result: res };
}

export function createPivot(e: Engine, o: { name?: string; src?: string; dest?: string; cfg?: Partial<PivotConfig> }): Out & { id?: string } {
  const wb = wbOf(e); if (!wb) return fail('No workbook open');
  let srcSheet = '', srcRange = '';
  const l = o.src ? parseRef(e, o.src) : null; const act = wb.getActiveSheet();
  if (o.src && !l) return fail(`Source range isn't valid: "${o.src}"`);
  if (l) { srcSheet = l.sheet.getSheetName(); srcRange = `${a1(l.r0, l.c0)}:${a1(l.r0 + l.rows - 1, l.c0 + l.cols - 1)}`; }
  else { const dr = act.getDataRange().getRange(); srcSheet = act.getSheetName(); srcRange = `${a1(dr.startRow, dr.startColumn)}:${a1(dr.endRow, dr.endColumn)}`; }
  const probe = sourceFields(e, srcSheet, srcRange); if (!probe || probe.rows < 1) return fail('The source range needs a header row and at least one data row.');
  let destSheet = srcSheet, anchor = '';
  if (o.dest) { const d = parseRef(e, o.dest); if (!d) return fail(`Destination isn't valid: "${o.dest}"`); destSheet = d.sheet.getSheetName(); anchor = a1(d.r0, d.c0); }
  else { const s = parseRef(e, `${qsheet(srcSheet)}!${srcRange}`)!; anchor = a1(s.r0, s.c0 + s.cols + 1); }
  const id = uid('pivot'); const def: PivotDef = { id, name: o.name?.trim() || `PivotTable${defs.length + 1}`, srcSheet, srcRange, destSheet, anchor, cfg: { ...defaultConfig(), ...(o.cfg ?? {}) }, auto: true, widgets: [], charts: [] };
  if (def.cfg.values.length === 0) { defs.push(def); return { ...ok(`PivotTable "${def.name}" created for ${destSheet}!${anchor}. Add fields, then Update.`), id }; }
  const r = buildPivot(e, def); if (!r.ok) return r; defs.push(def); return { ...r, id };
}
export function updatePivot(e: Engine, id: string, patch: Partial<Pick<PivotDef, 'name' | 'srcRange' | 'anchor' | 'auto'>> & { cfg?: Partial<PivotConfig> }): Out {
  const d = getPivot(id); if (!d) return fail('PivotTable not found'); const backup = JSON.stringify(d);
  if (patch.name !== undefined) d.name = patch.name; if (patch.srcRange) d.srcRange = patch.srcRange.replace(/\$/g, '').toUpperCase(); if (patch.auto !== undefined) d.auto = patch.auto;
  if (patch.anchor) { const a = parseRef(e, `${qsheet(d.destSheet)}!${patch.anchor}`); if (!a) return fail(`Destination isn't valid: "${patch.anchor}"`); if (d.last) { const ws = wbOf(e)?.getSheetByName(d.destSheet); if (ws) clearRect(ws, d.last); d.last = undefined; } d.anchor = a1(a.r0, a.c0); }
  if (patch.cfg) d.cfg = { ...d.cfg, ...patch.cfg };
  if (!d.cfg.values.length) return ok('Saved. Add at least one value field to build the PivotTable.');
  const r = buildPivot(e, d); if (!r.ok) Object.assign(d, JSON.parse(backup) as PivotDef); return r;
}
export function removePivot(e: Engine, id: string, clear = true): Out {
  const d = getPivot(id); if (!d) return fail('PivotTable not found'); const wb = wbOf(e);
  if (clear && d.last) { const ws = wb?.getSheetByName(d.destSheet); if (ws) clearRect(ws, d.last); }
  for (const w of d.widgets) removeFloatById(e, w.id); for (const c of d.charts) removeFloatById(e, c.id); for (const b of d.btns ?? []) removeFloatById(e, b);
  defs = defs.filter((x) => x.id !== id); return ok('PivotTable deleted');
}
function removeFloatById(e: Engine, id: string) { const wb = wbOf(e); if (!wb) return; for (const ws of wb.getSheets()) if (ws.getFloatDomById(id)) { ws.removeFloatDom(id); return; } }
interface FloatInfo { data?: unknown; position: { left?: number; top?: number; width?: number; height?: number } }
function findFloat(e: Engine, id: string): { ws: WS; f: FloatInfo } | null { const wb = wbOf(e); if (!wb) return null; for (const ws of wb.getSheets()) { const f = ws.getFloatDomById(id); if (f) return { ws: ws as WS, f: f as unknown as FloatInfo }; } return null; }

/** Refresh pivots whose source cells changed (called after workbook mutations). Returns how many were rebuilt. */
export function refreshPivots(e: Engine, force = false): number {
  let n = 0; for (const d of defs) { if (!d.auto && !force) continue; if (!d.cfg.values.length) continue; const s = readSource(e, d); if (!s) continue; if (force || s.sig !== d.sig) { const r = buildPivot(e, d); if (r.ok) n++; } } return n;
}

/* ---------- slicers & timelines ---------- */
export interface SlicerData { pivotId: string; field: string; title: string; items: Array<{ label: string; on: boolean }> }
export interface TimelineData { pivotId: string; field: string; title: string; months: Array<{ label: string; from: number; to: number }>; from: number | null; to: number | null }
function monthsOf(rows: Cell[][], col: number): TimelineData['months'] {
  const set = new Set<number>();
  for (const r of rows) { const v = r[col]; const s = typeof v === 'number' ? (v > 20000 ? Math.floor(v) : null) : typeof v === 'string' ? parseDateText(v) : null; if (s !== null) { const d = serialToDate(s); set.add(d.getUTCFullYear() * 12 + d.getUTCMonth()); } }
  return [...set].sort((a, b) => a - b).map((k) => { const y = Math.floor(k / 12), m = k % 12; return { label: `${MONTHS[m]} ${y}`, from: dateToSerial(y, m + 1, 1), to: dateToSerial(m === 11 ? y + 1 : y, m === 11 ? 1 : m + 2, 1) - 1 }; });
}
function slicerData(d: PivotDef, field: string, source: { fields: string[]; rows: Cell[][] }): SlicerData {
  const ex = new Set(d.cfg.filters.find((f) => f.field === field)?.exclude ?? []); return { pivotId: d.id, field, title: field, items: fieldItems(source, field, d.cfg.bins?.[field]).map((label) => ({ label, on: !ex.has(label) })) };
}
export function addSlicer(e: Engine, pivotId: string, field: string, kind: 'slicer' | 'timeline'): Out & { id?: string } {
  const d = getPivot(pivotId); if (!d) return fail('PivotTable not found'); const s = readSource(e, d); if (!s) return fail('Source range is not valid');
  if (!s.source.fields.includes(field)) return fail(`Field "${field}" isn't in the source`);
  if (kind === 'timeline' && !s.source.dateFields.includes(field)) return fail(`"${field}" doesn't contain dates, so it can't be used as a timeline.`);
  const ws = wbOf(e)?.getSheetByName(d.destSheet); if (!ws) return fail('Destination sheet missing');
  const base = d.last ? { c: d.last.c0, r: Math.max(d.last.r0 + d.last.rows + 2, d.last.r0 + 15) } : { c: 0, r: 0 }; const nSl = d.widgets.filter((w) => w.kind === 'slicer').length; const nTl = d.widgets.filter((w) => w.kind === 'timeline').length; const id = uid(kind);
  const data = kind === 'slicer' ? slicerData(d, field, s.source) : ({ pivotId, field, title: field, months: monthsOf(s.source.rows, s.source.fields.indexOf(field)), from: d.cfg.timeline?.from ?? null, to: d.cfg.timeline?.to ?? null } as TimelineData);
  const w = kind === 'slicer' ? 170 : 460, h = kind === 'slicer' ? Math.min(320, 64 + (data as SlicerData).items.length * 34) : 96;
  const at = kind === 'slicer' ? ws.getRange(base.r, base.c + nSl * 3, 1, 1) : ws.getRange(base.r + (nSl ? 14 : 0) + nTl * 5, base.c, 1, 1);
  const r = ws.addFloatDomToRange(at, { componentKey: kind === 'slicer' ? SLICER_KEY : TIMELINE_KEY, data: data as never, allowTransform: false }, { width: w, height: h, marginX: 4, marginY: 4 }, id);
  if (!r) return fail('The engine could not place the slicer'); d.widgets.push({ id, kind, field }); return { ...ok(`${kind === 'slicer' ? 'Slicer' : 'Timeline'} added`), id };
}
export function removeWidget(e: Engine, pivotId: string, widgetId: string): Out { const d = getPivot(pivotId); if (!d) return fail('PivotTable not found'); removeFloatById(e, widgetId); d.widgets = d.widgets.filter((w) => w.id !== widgetId); return ok('Removed'); }
function updateWidgets(e: Engine, d: PivotDef, source: { fields: string[]; rows: Cell[][] }) {
  for (const w of d.widgets) {
    const f = findFloat(e, w.id); if (!f) continue;
    const data = w.kind === 'slicer' ? slicerData(d, w.field, source) : { ...(f.f.data as unknown as TimelineData), from: d.cfg.timeline?.from ?? null, to: d.cfg.timeline?.to ?? null };
    replaceFloat(f.ws, w.id, w.kind === 'slicer' ? SLICER_KEY : TIMELINE_KEY, data, f.f.position);
  }
}
/** Field buttons on the grid (v77): a ▾ in each row-field header and the column-field header opens an item filter menu. */
export function placeFieldButtons(e: Engine, d: PivotDef) {
  if (!d.last || d.last.headRows === undefined) { for (const id of d.btns ?? []) removeFloatById(e, id); d.btns = []; return; } const ws = wbOf(e)?.getSheetByName(d.destSheet); if (!ws) return;
  const { r0, c0, headRows = 1, labelCols = 1 } = d.last; const spots: Array<{ r: number; c: number; field: string }> = [];
  if (d.cfg.layout === 'compact') { if (d.cfg.rows[0]) spots.push({ r: r0 + headRows - 1, c: c0, field: d.cfg.rows[0] }); } else d.cfg.rows.forEach((f, i) => { if (i < labelCols) spots.push({ r: r0 + headRows - 1, c: c0 + i, field: f }); });
  d.cfg.cols.forEach((f, j) => { if (j < headRows - 1 || (j === 0 && headRows >= 1)) spots.push({ r: r0 + j, c: c0 + labelCols, field: f }); });
  const key = d.destSheet + '|' + spots.map((x) => `${x.r},${x.c},${x.field}`).join(';') + '|' + spots.map((x) => ws.getColumnWidth(x.c)).join(','); if (d.btnKey === key && d.btns?.length && d.btns.every((id) => findFloat(e, id))) return;
  for (const id of d.btns ?? []) removeFloatById(e, id); d.btns = []; d.btnKey = key;
  for (const sp of spots) { const id = uid('pbtn'); const cell = ws.getRange(sp.r, sp.c, 1, 1); const w = ws.getColumnWidth(sp.c); const ok2 = ws.addFloatDomToRange(cell, { componentKey: PIVOTBTN_KEY, data: { pivotId: d.id, field: sp.field } as never, allowTransform: false }, { width: 18, height: 18, marginX: Math.max(0, w - 22), marginY: 2 }, id); if (ok2) d.btns.push(id); }
}
/** Recreate buttons after a reload (they are not stored in the file). */
export function ensureFieldButtons(e: Engine): number { let n = 0; for (const d of defs) { if (!d.last) continue; const live = (d.btns ?? []).filter((id) => findFloat(e, id)).length; if (!(d.btns?.length) || live !== d.btns.length) { placeFieldButtons(e, d); n++; } } return n; }
export function fieldMenu(e: Engine, pivotId: string, field: string): { items: Array<{ label: string; on: boolean }> } | null { const d = getPivot(pivotId); if (!d) return null; const s = readSource(e, d); if (!s || !s.source.fields.includes(field)) return null; return { items: slicerData(d, field, s.source).items }; }
/** Move/resize a slicer or timeline by a pixel delta (v75). Returns the new box. */
export function transformWidget(e: Engine, pivotId: string, kind: 'slicer' | 'timeline', field: string, dx: number, dy: number, dw: number, dh: number): Out & { box?: { left: number; top: number; width: number; height: number } } {
  const d = getPivot(pivotId); const w = d?.widgets.find((x) => x.kind === kind && x.field === field); if (!d || !w) return fail('Widget not found'); const f = findFloat(e, w.id); if (!f) return fail('Widget not on a sheet');
  const p = f.f.position as unknown as { left?: number; top?: number; width?: number; height?: number }; const minW = kind === 'slicer' ? 110 : 200, minH = kind === 'slicer' ? 80 : 70;
  const box = { left: Math.max(0, Math.round((p.left ?? 0) + dx)), top: Math.max(0, Math.round((p.top ?? 0) + dy)), width: Math.max(minW, Math.round((p.width ?? 170) + dw)), height: Math.max(minH, Math.round((p.height ?? 100) + dh)) };
  return replaceFloat(f.ws, w.id, kind === 'slicer' ? SLICER_KEY : TIMELINE_KEY, f.f.data, box) ? { ...ok('Moved'), box } : fail('The engine could not move the widget');
}
/** Slicer click: plain click = only this item; ctrl/shift click = toggle; label '*' = clear filter. */
export function slicerClick(e: Engine, pivotId: string, field: string, label: string, multi: boolean): Out {
  const d = getPivot(pivotId); if (!d) return fail('PivotTable not found'); const s = readSource(e, d); if (!s) return fail('Source range is not valid');
  const all = fieldItems(s.source, field, d.cfg.bins?.[field]); const cur = new Set(d.cfg.filters.find((f) => f.field === field)?.exclude ?? []); let next: Set<string>;
  if (label === '*') next = new Set();
  else if (multi) { next = new Set(cur); if (next.has(label)) next.delete(label); else next.add(label); if (next.size === all.length) next = new Set(); }
  else { const alreadyOnly = all.length > 1 && cur.size === all.length - 1 && !cur.has(label); next = alreadyOnly ? new Set() : new Set(all.filter((x) => x !== label)); }
  const filters = d.cfg.filters.filter((f) => f.field !== field); if (next.size) filters.push({ field, exclude: [...next] }); return updatePivot(e, pivotId, { cfg: { filters } });
}
export function timelineClick(e: Engine, pivotId: string, from: number | null, to: number | null): Out {
  const d = getPivot(pivotId); if (!d) return fail('PivotTable not found'); const field = d.widgets.find((w) => w.kind === 'timeline')?.field ?? '';
  return updatePivot(e, pivotId, { cfg: { timeline: from === null || to === null ? null : { field, from, to } } });
}

/* ---------- PivotCharts ---------- */
export function pivotSpec(res: PivotResult, cfg: PivotConfig, type: ChartType): ChartSpec {
  const hr = res.headRows;
  const body = res.grid.slice(hr).filter((row) => row[0]?.kind !== 'total' && !row.some((c) => c.kind === 'subtotal'));
  const dataCols = [...Array(res.cols - res.labelCols).keys()].map((j) => j + res.labelCols).filter((c) => res.grid.slice(hr).some((r) => r[c]?.kind === 'value'));
  const names = dataCols.map((c) => {
    const parts: string[] = [];
    for (let r = 1; r < hr; r++) { let cc = c; while (cc > res.labelCols && (res.grid[r][cc]?.v === '' || res.grid[r][cc]?.v === null)) cc--; const v = res.grid[r][cc]?.v; if (v !== null && v !== undefined && v !== '' && v !== 'Row Labels') parts.push(String(v)); }
    return parts.length ? [...new Set(parts)].join(' ') : String(res.grid[0][c]?.v ?? '');
  });
  const cats = body.map((row) => (res.labelCols > 1 ? row.slice(0, res.labelCols).map((c) => c.v).filter(Boolean).join(' / ') : String(row[0]?.v ?? '').trim()));
  const series: Series[] = dataCols.map((c, k) => ({ name: names[k] || `Series ${k + 1}`, values: body.map((row) => (typeof row[c]?.v === 'number' ? (row[c].v as number) : null)) }));
  void cfg; return { type, categories: cats, series, opts: { legend: series.length > 1 ? 'bottom' : 'none', grid: true } };
}
function updatePivotCharts(e: Engine, d: PivotDef, res: PivotResult) {
  for (const ch of d.charts) {
    const f = findFloat(e, ch.id); if (!f) continue; const old = f.f.data as unknown as { spec: ChartSpec; type: ChartType; title: string; opts: object };
    const spec = pivotSpec(res, d.cfg, old.type ?? ch.type); spec.title = old.title; spec.opts = { ...spec.opts, ...old.opts }; replaceFloat(f.ws, ch.id, CHART_KEY, { ...old, spec }, f.f.position);
  }
}
export function createPivotChart(e: Engine, pivotId: string, type: ChartType, title = ''): Out & { id?: string } {
  const d = getPivot(pivotId); if (!d) return fail('PivotTable not found'); const r = buildPivot(e, d); if (!r.ok || !r.result) return r;
  const spec = pivotSpec(r.result, d.cfg, type); spec.title = title; if (!spec.series.length || !spec.categories.length) return fail('The PivotTable has no data to chart.');
  const ws = wbOf(e)?.getSheetByName(d.destSheet); if (!ws || !d.last) return fail('Destination missing'); const id = uid('chart'); const at = ws.getRange(d.last.r0, d.last.c0 + d.last.cols + 1, 1, 1);
  const data = { spec, sheet: d.destSheet, range: '', type, title, byRows: false, opts: spec.opts, pivotId };
  const placed = ws.addFloatDomToRange(at, { componentKey: CHART_KEY, data: data as never, allowTransform: true }, { width: 480, height: 300, marginX: 6, marginY: 6 }, id); if (!placed) return fail('The engine could not place the chart');
  d.charts.push({ id, type }); return { ...ok('PivotChart added'), id };
}

pivotHook.spec = (id, type) => { const eng = (window as unknown as { __dracoEngine?: Engine }).__dracoEngine; const d = getPivot(id); if (!eng || !d) return null; const r = buildPivot(eng, d); return r.result ? pivotSpec(r.result, d.cfg, type) : null; };

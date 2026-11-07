// .xlsx import/export between Univer snapshots and ExcelJS workbooks (v79, v83).
import ExcelJS from 'exceljs';
import { injectCharts, type ChartOut } from './xlsxCharts';
import * as TM from '../tables/tableModel';
import { DEFAULT_COL_PX, DEFAULT_ROW_PX, OFFICE_THEME, applyTint, cellValue, colName, dateToSerial, fromArgb, orderedSheets, styleOf, toArgb, usedExtent, type Bd, type Cell, type SheetSnap, type Snap, type Style } from './model';

const BORDER_OUT: Record<number, ExcelJS.BorderStyle> = { 1: 'thin', 2: 'hair', 3: 'dotted', 4: 'dashed', 5: 'dashDot', 6: 'dashDotDot', 7: 'double', 8: 'medium', 9: 'mediumDashed', 10: 'mediumDashDot', 11: 'mediumDashDotDot', 12: 'slantDashDot', 13: 'thick' };
const BORDER_IN: Record<string, number> = Object.fromEntries(Object.entries(BORDER_OUT).map(([k, v]) => [v, +k]));
const sanitizeName = (n: string, used: Set<string>) => { let base = n.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet'; let out = base, i = 2; while (used.has(out.toLowerCase())) { const suf = ` (${i++})`; out = base.slice(0, 31 - suf.length) + suf; } used.add(out.toLowerCase()); return out; };

export async function snapshotToXlsx(snap: Snap, title = 'Workbook'): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Draco Sheets'; wb.title = title; wb.created = new Date();
  const used = new Set<string>(); const tbls = readTables(snap);
  for (const sh of orderedSheets(snap)) {
    const ws = wb.addWorksheet(sanitizeName(sh.name, used), { properties: sh.tabColor ? { tabColor: { argb: toArgb(sh.tabColor) } } : {}, state: sh.hidden ? 'hidden' : 'visible', views: [{ showGridLines: sh.showGridlines !== 0, ...(sh.freeze && (sh.freeze.xSplit > 0 || sh.freeze.ySplit > 0) ? { state: 'frozen' as const, xSplit: sh.freeze.xSplit, ySplit: sh.freeze.ySplit } : {}) }] });
    for (const [ck, col] of Object.entries(sh.columnData ?? {})) { const c = ws.getColumn(+ck + 1); if (col.hd) c.hidden = true; if (col.w) c.width = Math.max(0, (col.w - 5) / 7); }
    for (const [rk, row] of Object.entries(sh.rowData ?? {})) { const r = ws.getRow(+rk + 1); if (row.hd) r.hidden = true; if (row.h) r.height = row.h * 0.75; }
    for (const [rk, row] of Object.entries(sh.cellData ?? {})) for (const [ck, cell] of Object.entries(row)) {
      const st = styleOf(snap, cell); const hasStyle = Object.keys(st).length > 0; const v = cellValue(cell);
      if (v === null && !cell.f && !hasStyle) continue;
      const x = ws.getCell(+rk + 1, +ck + 1);
      if (cell.f) { const f = cell.f.startsWith('=') ? cell.f.slice(1) : cell.f; x.value = { formula: f, result: v === null ? undefined : (v as never) } as never; }
      else if (v !== null) x.value = v as never;
      if (hasStyle) applyStyleOut(x, st);
    }
    for (const m of sh.mergeData ?? []) { try { ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1); } catch { /* overlapping merge: skip */ } }
    addTablesOut(wb, ws, sh, snap, tbls);
  }
  const buf = await wb.xlsx.writeBuffer(); const out = new Uint8Array(buf as ArrayBuffer);
  try { return await injectCharts(out, chartsOf(snap), []); } catch { return out; }
}
function chartsOf(snap: Snap): ChartOut[] {
  const r = (snap.resources as Array<{ name: string; data: string }> | undefined)?.find((x) => x.name === 'DRACO_OBJECTS'); if (!r) return [];
  try { const objs = JSON.parse(r.data) as Array<{ key?: string; sheet: string; left: number; top: number; width: number; height: number; data?: { sheet?: string; range?: string; type?: string; title?: string; byRows?: boolean; opts?: { legend?: string } } }>; const names = new Map(orderedSheets(snap).map((s) => [s.id, s.name])); const out: ChartOut[] = [];
    for (const o of objs) { const d = o.data; if (!d?.range || !d.type) continue; out.push({ sheet: d.sheet ?? names.get(o.sheet) ?? o.sheet, range: d.range, type: d.type, title: d.title ?? '', byRows: !!d.byRows, left: o.left, top: o.top, width: o.width, height: o.height, legend: d.opts?.legend }); }
    return out; } catch { return []; }
}
interface TblRes { tables: TM.Table[]; formulas: Record<string, string> }
function readTables(snap: Snap): TblRes { const r = (snap.resources as Array<{ name: string; data: string }> | undefined)?.find((x) => x.name === 'draco.tables'); if (!r) return { tables: [], formulas: {} }; try { const o = JSON.parse(r.data) as Partial<TblRes>; return { tables: o.tables ?? [], formulas: o.formulas ?? {} }; } catch { return { tables: [], formulas: {} }; } }
/** Write real Excel tables (ListObjects): header, banding, total row functions and structured formulas. */
function addTablesOut(_wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, sh: SheetSnap, snap: Snap, tbls: TblRes) {
  for (const t of tbls.tables.filter((x) => x.sheet === sh.name)) {
    try {
      const { first, last } = TM.dataRows(t); const rows: Array<Array<ExcelJS.CellValue>> = [];
      for (let r = first; r <= last; r++) { const row: ExcelJS.CellValue[] = []; for (let c = t.c0; c <= t.c1; c++) { const cell = sh.cellData?.[r]?.[c]; const orig = tbls.formulas[`${sh.name}|${r}|${c}`]; const v = cellValue(cell);
        if (orig) row.push({ formula: TM.toExcelStructured(orig, t.name), result: v === null ? undefined : (v as never) } as never); else if (cell?.f) row.push({ formula: cell.f.replace(/^=/, ''), result: v === null ? undefined : (v as never) } as never); else row.push((v ?? null) as never); } rows.push(row); }
      const columns = t.headers.map((h, i) => { const fn = t.totals[i]; return i === 0 && t.totalRow ? { name: h, totalsRowLabel: 'Total' } : { name: h, ...(t.totalRow && fn && fn !== 'none' ? { totalsRowFunction: TM.totalFnToXlsx(fn) } : {}) }; });
      ws.addTable({ name: t.name, ref: `${TM.colName(t.c0)}${t.r0 + 1}`, headerRow: true, totalsRow: t.totalRow, style: { theme: TM.excelStyleOf(t.style) as never, showRowStripes: t.banded }, columns: columns as never, rows: rows as never });
    } catch { /* a table that Excel would reject is skipped; its cells are already in the sheet */ }
  }
  void snap;
}
function applyStyleOut(x: ExcelJS.Cell, st: Style) {
  if (st.n?.pattern && st.n.pattern !== 'General') x.numFmt = st.n.pattern;
  const font: Partial<ExcelJS.Font> = {}; if (st.bl) font.bold = true; if (st.it) font.italic = true; if (st.ul?.s) font.underline = true; if (st.st?.s) font.strike = true; if (st.fs) font.size = st.fs; if (st.ff) font.name = st.ff; const fc = toArgb(st.cl?.rgb); if (fc) font.color = { argb: fc };
  if (Object.keys(font).length) x.font = font;
  const bg = toArgb(st.bg?.rgb); if (bg) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  const al: Partial<ExcelJS.Alignment> = {}; if (st.ht) al.horizontal = ({ 1: 'left', 2: 'center', 3: 'right' } as const)[st.ht as 1 | 2 | 3]; if (st.vt) al.vertical = ({ 1: 'top', 2: 'middle', 3: 'bottom' } as const)[st.vt as 1 | 2 | 3]; if (st.tb === 3) al.wrapText = true;
  if (Object.keys(al).length) x.alignment = al;
  if (st.bd) { const b: Partial<ExcelJS.Borders> = {}; const one = (d?: Bd) => (d && d.s ? { style: BORDER_OUT[d.s] ?? 'thin', ...(toArgb(d.cl?.rgb) ? { color: { argb: toArgb(d.cl?.rgb) as string } } : {}) } : undefined); const t = one(st.bd.t), bt = one(st.bd.b), l = one(st.bd.l), r = one(st.bd.r); if (t) b.top = t; if (bt) b.bottom = bt; if (l) b.left = l; if (r) b.right = r; if (Object.keys(b).length) x.border = b; }
}

export interface ImportResult { snap: Snap; warnings: string[] }
const colorIn = (c: (Partial<ExcelJS.Color> & { tint?: number }) | undefined): string | undefined => {
  if (!c) return undefined; if (c.argb) return fromArgb(c.argb);
  if (typeof c.theme === 'number') { const base = OFFICE_THEME[c.theme] ?? '#000000'; return c.tint ? applyTint(base, c.tint) : base; } return undefined;
};
export async function xlsxToSnapshot(buf: ArrayBuffer | Uint8Array, name = 'Imported workbook', opts: { macroFile?: boolean } = {}): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook(); const warnings: string[] = [];
  try { await wb.xlsx.load((buf instanceof Uint8Array ? buf : new Uint8Array(buf)) as never); } catch (e) { throw new Error(`This doesn't look like a valid .xlsx file (${(e as Error).message}).`); }
  if (opts.macroFile) warnings.push('Macros (VBA) were not imported; only the sheets, formulas and formatting were kept.');
  const snapResources: unknown[] = [];
  const styles: Record<string, Style> = {}; const styleIds = new Map<string, string>();
  const sid = (st: Style): string | undefined => { if (!Object.keys(st).length) return undefined; const k = JSON.stringify(st); let id = styleIds.get(k); if (!id) { id = 's' + styleIds.size.toString(36); styleIds.set(k, id); styles[id] = st; } return id; };
  const sheets: Record<string, SheetSnap> = {}; const order: string[] = []; let dropped = false; const tables: TM.Table[] = []; const tformulas: Record<string, string> = {};
  wb.eachSheet((ws, idx) => {
    const id = `sheet-${idx}`; order.push(id); const cellData: Record<string, Record<string, Cell>> = {}; let maxR = 0, maxC = 0;
    ws.eachRow({ includeEmpty: true }, (row, rn) => row.eachCell({ includeEmpty: true }, (x, cn) => {
      const cell: Cell = {}; const val = x.value as unknown;
      if (val !== null && val !== undefined) setValue(cell, val);
      const st = styleIn(x); const s = sid(st); if (s) cell.s = s;
      if (cell.v === undefined && !cell.f && !cell.s) return;
      (cellData[rn - 1] ??= {})[cn - 1] = cell; maxR = Math.max(maxR, rn); maxC = Math.max(maxC, cn);
    }));
    const columnData: SheetSnap['columnData'] = {}; ws.columns?.forEach((c, i) => { if (c.width || c.hidden) columnData[i] = { ...(c.width ? { w: Math.round(c.width * 7 + 5) } : {}), ...(c.hidden ? { hd: 1 } : {}) }; });
    const rowData: SheetSnap['rowData'] = {}; ws.eachRow({ includeEmpty: false }, (row, rn) => { if (row.height || row.hidden) rowData[rn - 1] = { ...(row.height ? { h: Math.round(row.height / 0.75) } : {}), ...(row.hidden ? { hd: 1 } : {}) }; });
    const mergeData: NonNullable<SheetSnap['mergeData']> = []; const merges = (ws as unknown as { model: { merges?: string[] } }).model.merges ?? [];
    for (const m of merges) { const [a, b] = m.split(':'); const p = parseRange(a), q = parseRange(b ?? a); if (p && q) mergeData.push({ startRow: p.r, startColumn: p.c, endRow: q.r, endColumn: q.c }); }
    const view = ws.views?.[0] as { state?: string; xSplit?: number; ySplit?: number; showGridLines?: boolean } | undefined;
    const tab = colorIn(ws.properties?.tabColor as Partial<ExcelJS.Color> | undefined);
    const sh: SheetSnap = { id, name: ws.name, rowCount: Math.max(1000, maxR + 100), columnCount: Math.max(26, maxC + 10), cellData, mergeData, rowData, columnData, defaultColumnWidth: DEFAULT_COL_PX, defaultRowHeight: DEFAULT_ROW_PX, showGridlines: view?.showGridLines === false ? 0 : 1, ...(tab ? { tabColor: tab } : {}), ...(ws.state === 'hidden' || ws.state === 'veryHidden' ? { hidden: 1 } : {}) };
    if (view?.state === 'frozen' && ((view.xSplit ?? 0) > 0 || (view.ySplit ?? 0) > 0)) sh.freeze = { xSplit: view.xSplit ?? 0, ySplit: view.ySplit ?? 0, startRow: view.ySplit ?? 0, startColumn: view.xSplit ?? 0 };
    sheets[id] = sh;
    for (const tb of (ws as unknown as { getTables?: () => Array<{ table?: Record<string, unknown>; model?: Record<string, unknown> }> }).getTables?.() ?? []) {
      const m = (tb.table ?? tb.model ?? {}) as { name?: string; tableRef?: string; ref?: string; headerRow?: boolean; totalsRow?: boolean; columns?: Array<{ name: string; totalsRowFunction?: string }>; style?: { theme?: string; showRowStripes?: boolean } };
      const ref = (m.tableRef ?? m.ref ?? '').split(':'); const a = parseRange(ref[0] ?? ''), b = parseRange(ref[1] ?? ref[0] ?? ''); if (!m.name || !a || !b || m.headerRow === false || !m.columns?.length) { warnings.push(`A table${m.name ? ` ("${m.name}")` : ''} without a header row was imported as plain cells.`); continue; }
      const totals: TM.Table['totals'] = {}; (m.columns ?? []).forEach((c, i) => { const f = TM.totalFnFromXlsx(c.totalsRowFunction); if (m.totalsRow && f !== 'none') totals[i] = f; });
      tables.push({ id: `tbl_${tables.length}${Date.now().toString(36)}`, name: m.name, sheet: ws.name, r0: a.r, c0: a.c, r1: b.r, c1: b.c, headers: m.columns.map((c) => c.name), style: TM.styleFromExcel(m.style?.theme), banded: m.style?.showRowStripes !== false, totalRow: !!m.totalsRow, filter: false, totals, needsFormat: true });
    }
    const extra = ws as unknown as { conditionalFormattings?: unknown[]; dataValidations?: { model?: Record<string, unknown> }; getImages?: () => unknown[] };
    if ((extra.conditionalFormattings?.length ?? 0) > 0 || Object.keys(extra.dataValidations?.model ?? {}).length > 0 || (extra.getImages?.().length ?? 0) > 0) dropped = true;
  });
  if (tables.length) {
    // Excel writes structured references (Table1[[#This Row],[Col]]) into the file: resolve them to A1 for the engine and keep the original text.
    for (const sh of Object.values(sheets)) for (const [rk, row] of Object.entries(sh.cellData ?? {})) for (const [ck, cell] of Object.entries(row)) { if (!cell.f) continue; const r = TM.resolveFormula(cell.f, tables, { sheet: sh.name, row: +rk, col: +ck }); if (r.used && !r.error) { tformulas[`${sh.name}|${rk}|${ck}`] = cell.f; cell.f = r.formula; } }
    (snapResources as Array<{ name: string; data: string }>).push({ name: 'draco.tables', data: JSON.stringify({ tables, formulas: tformulas, slicerEx: {}, slicers: [] }) });
    warnings.push(`${tables.length} Excel table${tables.length === 1 ? '' : 's'} imported as Draco tables (Tools > Tables).`);
  }
  if (dropped) warnings.push('Conditional formats, data validation rules or pictures in the file were not imported.');
  if (!order.length) throw new Error('The file has no worksheets.');
  return { snap: { id: '', name, sheetOrder: order, sheets, styles, locale: 'enUS', resources: snapResources } as Snap, warnings };
}
function parseRange(a: string): { r: number; c: number } | null { const m = /^([A-Z]+)(\d+)$/.exec(a); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return { r: +m[2] - 1, c: c - 1 }; }
function setValue(cell: Cell, val: unknown) {
  if (typeof val === 'number') { cell.v = val; cell.t = 2; }
  else if (typeof val === 'string') { cell.v = val; cell.t = 1; }
  else if (typeof val === 'boolean') { cell.v = val ? 1 : 0; cell.t = 3; }
  else if (val instanceof Date) { cell.v = Math.round(dateToSerial(val) * 1e6) / 1e6; cell.t = 2; }
  else if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    if ('formula' in o || 'sharedFormula' in o) { const f = (o.formula as string | undefined) ?? (o.sharedFormula as string | undefined) ?? ''; if (f) cell.f = '=' + f; else if (typeof o.sharedFormula === 'string') cell.f = '=' + o.sharedFormula; const r = o.result; if (r instanceof Date) { cell.v = dateToSerial(r); cell.t = 2; } else if (typeof r === 'number') { cell.v = r; cell.t = 2; } else if (typeof r === 'string') { cell.v = r; cell.t = 1; } else if (typeof r === 'boolean') { cell.v = r ? 1 : 0; cell.t = 3; } else if (r && typeof r === 'object' && 'error' in (r as object)) { cell.v = String((r as { error: string }).error); cell.t = 1; } }
    else if ('richText' in o) { cell.v = (o.richText as Array<{ text: string }>).map((x) => x.text).join(''); cell.t = 1; }
    else if ('hyperlink' in o) { cell.v = String(o.text ?? o.hyperlink ?? ''); cell.t = 1; }
    else if ('error' in o) { cell.v = String(o.error); cell.t = 1; }
  }
}
function styleIn(x: ExcelJS.Cell): Style {
  const st: Style = {}; const f = x.font; const fill = x.fill as ExcelJS.FillPattern | undefined; const al = x.alignment; const bd = x.border;
  if (f) { if (f.bold) st.bl = 1; if (f.italic) st.it = 1; if (f.underline) st.ul = { s: 1 }; if (f.strike) st.st = { s: 1 }; if (f.size && f.size !== 11) st.fs = f.size; if (f.name && f.name !== 'Calibri') st.ff = f.name; const c = colorIn(f.color); if (c && c !== '#000000') st.cl = { rgb: c }; }
  if (fill?.type === 'pattern' && fill.pattern === 'solid') { const c = colorIn(fill.fgColor); if (c) st.bg = { rgb: c }; }
  if (al) { if (al.horizontal === 'left' || al.horizontal === 'center' || al.horizontal === 'right') st.ht = { left: 1, center: 2, right: 3 }[al.horizontal]; if (al.vertical === 'top' || al.vertical === 'middle' || al.vertical === 'bottom') st.vt = { top: 1, middle: 2, bottom: 3 }[al.vertical]; if (al.wrapText) st.tb = 3; }
  if (bd) { const one = (d?: Partial<ExcelJS.Border>): Bd | undefined => (d && d.style ? { s: BORDER_IN[d.style] ?? 1, cl: { rgb: colorIn(d.color) ?? '#000000' } } : undefined); const o: NonNullable<Style['bd']> = {}; const t = one(bd.top), b = one(bd.bottom), l = one(bd.left), r = one(bd.right); if (t) o.t = t; if (b) o.b = b; if (l) o.l = l; if (r) o.r = r; if (Object.keys(o).length) st.bd = o; }
  if (x.numFmt && x.numFmt !== 'General') st.n = { pattern: x.numFmt };
  return st;
}
export { colName, usedExtent };

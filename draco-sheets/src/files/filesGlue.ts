// Engine glue for files & interop (v79-v86): import/export, printing, clipboard paste.
import type { Engine } from '../engine';
import { registerResource } from '../persist';
import { selectionLoc, type Out } from '../dataGlue';
import { a1, orderedSheets, usedExtent, type Snap, type SheetSnap } from './model';
import { snapshotToXlsx, xlsxToSnapshot } from './xlsx';
import { delimitedToSnapshot, gridToDelimited, jsonToSnapshot, odsToSnapshot, sheetToGrid, snapshotToJson, snapshotToOds, type Val } from './convert';
import { mergeSetup, renderPages, printHtml, pageToSvg, layoutSheet, type PageSetup, type PageOps, type Layout } from './print';
import { pagesToPdf } from './pdf';
import { clipToGrid, type ClipGrid } from './clip';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'json' | 'ods' | 'txt';
export interface Exported { name: string; data: Uint8Array | string; mime: string }
const ok = (message: string): Out => ({ ok: true, message }); const fail = (message: string): Out => ({ ok: false, message });
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
const safeName = (s: string) => (s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Workbook').slice(0, 80);

/** Persisted page setups (per sheet id). */
let setups: Record<string, Partial<PageSetup>> = {};
registerResource('DRACO_PRINT', { get: () => (Object.keys(setups).length ? setups : undefined), set: (v) => { setups = v && typeof v === 'object' && !Array.isArray(v) ? (v as typeof setups) : {}; }, reset: () => { setups = {}; } });
export const getSetup = (sheetId: string): PageSetup => mergeSetup(setups[sheetId]);
export const saveSetup = (sheetId: string, s: PageSetup) => { setups[sheetId] = s; };

/** The workbook as a snapshot (formula cells already carry their computed value). */
export function fullSnapshot(e: Engine): Snap | null { const wb = wbOf(e); return wb ? (wb.save() as unknown as Snap) : null; }
export function sheetSnap(snap: Snap, name: string): SheetSnap | undefined { return orderedSheets(snap).find((s) => s.name === name); }

function displayGrid(e: Engine, sheetName: string, sh: SheetSnap, minRows = 0, minCols = 0): string[][] {
  const ws = wbOf(e)?.getSheetByName(sheetName); const ext = usedExtent(sh); const R = Math.max(ext.r + 1, minRows), C = Math.max(ext.c + 1, minCols); if (!ws || R <= 0 || C <= 0) return [];
  return ws.getRange(0, 0, Math.min(R, 100000), Math.min(C, 2000)).getDisplayValues() as string[][];
}

export async function exportAs(e: Engine, fmt: ExportFormat, title: string, o: { sheet?: string; display?: boolean; allSheets?: boolean; header?: boolean; bom?: boolean; pretty?: boolean } = {}): Promise<Exported> {
  const snap = fullSnapshot(e); if (!snap) throw new Error('No workbook open'); const base = safeName(title); const sheets = orderedSheets(snap); const active = o.sheet ?? wbOf(e)?.getActiveSheet().getSheetName() ?? sheets[0].name;
  if (fmt === 'xlsx') return { name: `${base}.xlsx`, data: await snapshotToXlsx(snap, title), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  if (fmt === 'ods') return { name: `${base}.ods`, data: await snapshotToOds(snap), mime: 'application/vnd.oasis.opendocument.spreadsheet' };
  if (fmt === 'json') { const idx = Math.max(0, sheets.findIndex((s) => s.name === active)); return { name: `${base}.json`, data: snapshotToJson(snap, { header: o.header !== false, pretty: o.pretty !== false, allSheets: o.allSheets, sheet: idx }), mime: 'application/json' }; }
  const sh = sheetSnap(snap, active) ?? sheets[0]; const raw = sheetToGrid(sh); const disp = o.display === false ? null : displayGrid(e, sh.name, sh);
  const grid: Array<Array<Val | undefined>> = disp ? raw.map((row, r) => row.map((v, c) => (v === null ? null : disp[r]?.[c] ?? v))) : raw; const delim = fmt === 'csv' ? ',' : '\t';
  return { name: `${base}${sheets.length > 1 ? ` - ${safeName(sh.name)}` : ''}.${fmt === 'txt' ? 'txt' : fmt}`, data: gridToDelimited(grid, delim, { bom: o.bom !== false && fmt === 'csv' }), mime: fmt === 'csv' ? 'text/csv' : 'text/tab-separated-values' };
}
export function download(ex: Exported) {
  const blob = new Blob([ex.data as BlobPart], { type: ex.mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = ex.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- import ---------- */
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
export function decodeText(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2)); if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  const t = new TextDecoder('utf-8', { fatal: false }).decode(buf); return t.replace(/^﻿/, '');
}
export interface Imported { snap: Snap; title: string; warnings: string[]; kind: string }
export async function importBytes(name: string, buf: Uint8Array): Promise<Imported> {
  const dot = name.lastIndexOf('.'); const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''; const title = name.replace(/\.[^.]+$/, '') || 'Imported workbook'; const isZip = buf[0] === 0x50 && buf[1] === 0x4b; const isOle = OLE.every((b, i) => buf[i] === b);
  if (!buf.length) throw new Error('The file is empty.');
  if (isOle || ext === 'xls' && !isZip) {
    // Legacy BIFF .xls (v83): parsed lazily by SheetJS, then converted to .xlsx and read by the normal importer.
    let xlsxBytes: Uint8Array; try { const X = await import('@e965/xlsx'); const wb = X.read(buf, { type: 'array', cellDates: false, cellNF: true, cellStyles: true }); if (!wb.SheetNames.length) throw new Error('no sheets'); xlsxBytes = new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as ArrayBuffer); } catch (err) { throw new Error(`"${name}" couldn't be read as an old Excel (.xls) file (${(err as Error).message}). If it is password-protected, remove the password in Excel first.`); }
    const r = await xlsxToSnapshot(xlsxBytes, title, { macroFile: false }); return { ...r, title, warnings: [...r.warnings, 'Opened from an old .xls file: cell values and number formats are kept; formulas may come in as their results, and some fonts, charts and pictures from the original are not.'], kind: 'xls' };
  }
  if (isZip || ['xlsx', 'xlsm', 'xltx', 'xltm', 'ods'].includes(ext)) {
    if (!isZip) throw new Error(`"${name}" isn't a valid spreadsheet archive.`);
    const JSZip = (await import('jszip')).default; const z = await JSZip.loadAsync(buf).catch(() => null); if (!z) throw new Error(`"${name}" is damaged or not a spreadsheet.`);
    if (z.file('content.xml') && !z.file('xl/workbook.xml')) { const r = await odsToSnapshot(buf, title); return { ...r, title, kind: 'ods' }; }
    if (z.file('xl/workbook.xml')) { const macro = ['xlsm', 'xltm'].includes(ext) || !!z.file('xl/vbaProject.bin'); const r = await xlsxToSnapshot(buf, title, { macroFile: macro }); return { ...r, title, kind: macro ? 'xlsm' : 'xlsx' }; }
    throw new Error(`"${name}" is a zip archive but not a spreadsheet.`);
  }
  const text = decodeText(buf);
  if (ext === 'json' || /^\s*[[{]/.test(text) && ext !== 'csv' && ext !== 'tsv') { try { return { snap: jsonToSnapshot(text, title), title, warnings: [], kind: 'json' }; } catch (err) { if (ext === 'json') throw new Error(`The JSON file couldn't be read: ${(err as Error).message}`); } }
  const delim = ext === 'tsv' ? '\t' : ext === 'csv' ? undefined : undefined;
  return { snap: delimitedToSnapshot(text, delim, 'Sheet1', title), title, warnings: text.length > 5_000_000 ? ['Large file: this may take a moment to load.'] : [], kind: ext === 'tsv' ? 'tsv' : 'csv' };
}
export async function importFile(file: File): Promise<Imported> { return importBytes(file.name, new Uint8Array(await file.arrayBuffer())); }

/* ---------- printing ---------- */
export interface PrintBuild { layout: Layout; pages: PageOps[]; sheetId: string; sheetName: string; setup: PageSetup }
export function buildPrint(e: Engine, sheetName: string | undefined, title: string, override?: Partial<PageSetup>): PrintBuild | { error: string } {
  const snap = fullSnapshot(e); if (!snap) return { error: 'No workbook open' }; const sheets = orderedSheets(snap); const name = sheetName ?? wbOf(e)?.getActiveSheet().getSheetName() ?? sheets[0]?.name; const sh = sheets.find((s) => s.name === name); if (!sh) return { error: `Sheet "${name}" not found` };
  const setup = mergeSetup({ ...setups[sh.id], ...(override ?? {}) }); const pre = layoutSheet(sh, setup); if (pre.error) return { error: pre.error };
  const disp = displayGrid(e, sh.name, sh, pre.area.r1 + 1, pre.area.c1 + 1); const { layout, pages } = renderPages({ snap, sheet: sh, setup, fileName: title, display: (r, c) => disp[r]?.[c] ?? '' });
  return { layout, pages, sheetId: sh.id, sheetName: sh.name, setup };
}
export function printPages(pages: PageOps[], title: string): Out {
  if (!pages.length) return fail('Nothing to print.');
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const doc = f.contentDocument; if (!doc) { f.remove(); return fail('Printing is blocked in this browser.'); }
  doc.open(); doc.write(printHtml(pages, title)); doc.close();
  const go = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { /* user cancelled */ } setTimeout(() => f.remove(), 60_000); };
  setTimeout(go, 250); return ok(`Sent ${pages.length} page${pages.length === 1 ? '' : 's'} to the print dialog.`);
}
export const pdfFor = (pages: PageOps[], title: string): Exported => ({ name: `${safeName(title)}.pdf`, data: pagesToPdf(pages, title), mime: 'application/pdf' });
export { pageToSvg };

/* ---------- paste from Excel / Sheets ---------- */
const HA = ['left', 'center', 'normal'] as const; const VA = ['top', 'middle', 'bottom'] as const;
export function pasteGrid(e: Engine, g: ClipGrid, at?: { r: number; c: number }): Out {
  const wb = wbOf(e); const ws = wb?.getActiveSheet(); if (!wb || !ws) return fail('No workbook open'); const sel = selectionLoc(e); const r0 = at?.r ?? sel?.r0 ?? 0, cell0 = at?.c ?? sel?.c0 ?? 0;
  const rows = g.rows, cols = g.cols; let written = 0, styled = 0;
  const vals: Array<Array<string | number | boolean | null>> = g.cells.map((row) => row.map((c) => (c && c.v !== undefined && !c.f ? (typeof c.v === 'boolean' ? c.v : c.v) : null)));
  ws.getRange(r0, cell0, rows, cols).setValues(vals as never);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = g.cells[r][c]; if (!cell) continue; const rg = ws.getRange(r0 + r, cell0 + c, 1, 1);
    if (cell.f) { try { rg.setFormula(cell.f); } catch { rg.setValue(cell.v as never); } } if (cell.v !== undefined || cell.f) written++;
    const st = cell.style; const keys = Object.keys(st); if (!keys.length) continue; styled++;
    if (st.bl) rg.setFontWeight('bold'); if (st.it) rg.setFontStyle('italic'); if (st.ul) rg.setFontLine('underline'); else if (st.st) rg.setFontLine('line-through'); if (st.cl?.rgb) rg.setFontColor(st.cl.rgb); if (st.bg?.rgb) rg.setBackground(st.bg.rgb); if (st.fs) rg.setFontSize(st.fs); if (st.ff) rg.setFontFamily(st.ff);
    if (st.ht) rg.setHorizontalAlignment(HA[st.ht - 1]); if (st.vt) rg.setVerticalAlignment(VA[st.vt - 1]); if (st.tb === 3) rg.setWrap(true); if (st.n?.pattern) rg.setNumberFormat(st.n.pattern);
    if (st.bd) { const En = e.api.Enum as unknown as { BorderType: Record<string, never>; BorderStyleTypes: Record<string, never> }; const sty = (n?: number) => En.BorderStyleTypes[n === 8 ? 'MEDIUM' : n === 4 ? 'DASHED' : n === 3 ? 'DOTTED' : n === 7 ? 'DOUBLE' : n === 13 ? 'THICK' : 'THIN'];
      for (const [k, side] of [['t', 'TOP'], ['b', 'BOTTOM'], ['l', 'LEFT'], ['r', 'RIGHT']] as const) { const d = st.bd[k]; if (d?.s) { try { rg.setBorder(En.BorderType[side], sty(d.s), d.cl?.rgb ?? '#000000'); } catch { /* border unsupported */ } } } }
  }
  for (const m of g.merges) { try { ws.getRange(r0 + m.r, cell0 + m.c, m.rows, m.cols).merge(); } catch { /* overlaps existing merge */ } }
  ws.getRange(r0, cell0, rows, cols).activate();
  return ok(`Pasted ${written} cell${written === 1 ? '' : 's'} (${rows}×${cols}) at ${a1(r0, cell0)}${styled ? `, with formatting on ${styled}` : ''}${g.source === 'excel' ? ' — from Excel' : g.source === 'sheets' ? ' — from Google Sheets' : ''}.`);
}

/* test / scripting hooks */
if (typeof window !== 'undefined') {
  const eng = () => (window as unknown as { __dracoEngine: Engine }).__dracoEngine;
  (window as unknown as { dracoFiles: unknown }).dracoFiles = {
    exportAs: async (fmt: ExportFormat, o?: Parameters<typeof exportAs>[3]) => { const x = await exportAs(eng(), fmt, 'Test', o); return { name: x.name, mime: x.mime, text: typeof x.data === 'string' ? x.data : null, bytes: typeof x.data === 'string' ? null : Array.from(x.data) }; },
    importBytes: async (name: string, bytes: number[]) => { const r = await importBytes(name, new Uint8Array(bytes)); return { title: r.title, kind: r.kind, warnings: r.warnings, sheets: orderedSheets(r.snap).map((s) => s.name) }; },
    print: (sheet?: string, o?: Partial<PageSetup>) => { const b = buildPrint(eng(), sheet, 'Test', o); return 'error' in b ? { error: b.error } : { pages: b.pages.length, scale: b.layout.scale, warnings: b.layout.warnings, texts: b.pages.map((p) => p.ops.filter((x) => x.k === 'text').map((x) => (x as { text: string }).text)) }; },
    pdf: (sheet?: string, o?: Partial<PageSetup>) => { const b = buildPrint(eng(), sheet, 'Test', o); return 'error' in b ? null : Array.from(pagesToPdf(b.pages, 'Test')); },
    paste: (html: string | undefined, text: string | undefined, at?: { r: number; c: number }) => { const g = clipToGrid(html, text); return g ? pasteGrid(eng(), g, at) : { ok: false, message: 'nothing to paste' }; },
  };
}

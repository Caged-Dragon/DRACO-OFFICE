// Engine glue for sparklines, shapes/text boxes/icons, diagrams and camera pictures (v69-v72).
import type { Engine } from '../engine';
import { parseRef, targetLoc, readValues, readDisplay, type Out } from '../dataGlue';
import { a1 } from '../audit';
import { cellOrigin, replaceFloat, type WS } from '../charts/chartGlue';
import { SPARK_KEY, SHAPE_KEY, DIAGRAM_KEY, CAMERA_KEY } from './keys';
import type { SparkOpts } from './spark';
import type { ShapeData } from './shapes';
import type { DiagramData } from './diagrams';
import type { CamCell, CamData } from './camera';

const ok = (message: string): Out => ({ ok: true, message });
const fail = (message: string): Out => ({ ok: false, message });
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
const qsheet = (n: string) => (/^[A-Za-z0-9_]+$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v.replace(/[,$%\s]/g, '')) ? +v.replace(/[,$%\s]/g, '') : null);

/* ---------- sparklines ---------- */
export interface SparkData { sheet: string; src: string; loc: string; values: Array<number | null>; opts: SparkOpts }
export function createSparklines(e: Engine, o: { src?: string; loc: string; opts: SparkOpts; byColumn?: boolean }): Out & { ids?: string[] } {
  const wb = wbOf(e); if (!wb) return fail('No workbook open');
  const src = o.src ? parseRef(e, o.src) : targetLoc(e); if (!src) return fail(`Data range isn't valid: "${o.src ?? ''}"`);
  const loc = parseRef(e, o.loc); if (!loc) return fail(`Location isn't valid: "${o.loc}"`);
  const grid = readValues(src); const lines: Array<{ vals: Array<number | null>; srcA1: string }> = [];
  if (o.byColumn) for (let c = 0; c < src.cols; c++) lines.push({ vals: grid.map((r) => numOrNull(r[c])), srcA1: `${a1(src.r0, src.c0 + c)}:${a1(src.r0 + src.rows - 1, src.c0 + c)}` });
  else for (let r = 0; r < src.rows; r++) lines.push({ vals: (grid[r] ?? []).map(numOrNull), srcA1: `${a1(src.r0 + r, src.c0)}:${a1(src.r0 + r, src.c0 + src.cols - 1)}` });
  const slots = loc.rows * loc.cols; if (slots < lines.length && slots !== 1) return fail(`Location range has ${slots} cells but ${lines.length} sparklines are needed.`);
  const ws = loc.sheet; const ids: string[] = [];
  lines.forEach((ln, i) => {
    const r = loc.r0 + (loc.cols === 1 || slots === 1 ? i : 0), c = loc.c0 + (loc.cols > 1 && loc.rows === 1 ? i : 0); const cell = ws.getRange(r, c, 1, 1);
    const w = Math.max(30, ws.getColumnWidth(c) - 4), h = Math.max(14, ws.getRowHeight(r) - 4); const id = uid('spark');
    const data: SparkData = { sheet: ws.getSheetName(), src: `${src.sheet.getSheetName()}!${ln.srcA1}`, loc: a1(r, c), values: ln.vals, opts: o.opts };
    if (ws.addFloatDomToRange(cell, { componentKey: SPARK_KEY, data: data as never, allowTransform: false }, { width: w, height: h, marginX: 2, marginY: 2 }, id)) ids.push(id);
  });
  return { ...ok(`${ids.length} sparkline${ids.length === 1 ? '' : 's'} added`), ids };
}
/** Keep a sparkline glued to its cell when rows/columns are resized, inserted or deleted (v69). */
function refitSparkline(ws: WS, id: string, d: SparkData): number {
  const cell = ws.getRange(d.loc); const r = cell.getRow(), c = cell.getColumn(); const f = ws.getFloatDomById(id); if (!f) return 0; const p = f.position as unknown as { left?: number; top?: number; width?: number; height?: number };
  const o = cellOrigin(ws, r, c); const left = o.left + 2, top = o.top + 2;
  const w = Math.max(30, ws.getColumnWidth(c) - 4), h = Math.max(14, ws.getRowHeight(r) - 4);
  if (Math.abs((p.left ?? 0) - left) < 1.5 && Math.abs((p.top ?? 0) - top) < 1.5 && Math.abs((p.width ?? 0) - w) < 1.5 && Math.abs((p.height ?? 0) - h) < 1.5) return 0;
  return replaceFloat(ws, id, SPARK_KEY, f.data, { left, top, width: w, height: h }) ? 1 : 0;
}
export function refreshSparklines(e: Engine): number {
  const wb = wbOf(e); if (!wb) return 0; let n = 0;
  for (const ws of wb.getSheets()) for (const f of ws.getAllFloatDoms()) {
    if (f?.componentKey !== SPARK_KEY) continue; const d = f.data as unknown as SparkData; const bang = d.src.lastIndexOf('!'); const l = parseRef(e, `${qsheet(d.src.slice(0, bang))}!${d.src.slice(bang + 1)}`); if (!l) continue;
    n += refitSparkline(ws, f.id, d);
    const vals = (readValues(l).flat() as unknown[]).map(numOrNull);
    if (JSON.stringify(vals) !== JSON.stringify(d.values) && replaceFloat(ws, f.id, SPARK_KEY, { ...d, values: vals }, f.position)) n++;
  }
  return n;
}
export function setSparkOpts(e: Engine, loc: string, opts: Partial<SparkOpts>): Out {
  const wb = wbOf(e); const ws = wb?.getActiveSheet(); if (!ws) return fail('No sheet'); let n = 0;
  for (const f of ws.getAllFloatDoms()) if (f?.componentKey === SPARK_KEY) { const d = f.data as unknown as SparkData; if (d.loc === loc.toUpperCase() || loc === '*') { if (replaceFloat(ws, f.id, SPARK_KEY, { ...d, opts: { ...d.opts, ...opts } }, f.position)) n++; } }
  return n ? ok(`${n} sparkline${n === 1 ? '' : 's'} updated`) : fail('No sparkline at that cell');
}
export function clearSparklines(e: Engine, scope: 'selection' | 'sheet'): Out {
  const ws = wbOf(e)?.getActiveSheet(); if (!ws) return fail('No sheet');
  const sel = scope === 'selection' ? targetLoc(e) : null; let n = 0;
  for (const f of ws.getAllFloatDoms()) if (f?.componentKey === SPARK_KEY) {
    const d = f.data as unknown as SparkData; if (sel) { const l = parseRef(e, d.loc); if (!l || l.r0 < sel.r0 || l.r0 >= sel.r0 + sel.rows || l.c0 < sel.c0 || l.c0 >= sel.c0 + sel.cols) continue; }
    ws.removeFloatDom(f.id); n++;
  }
  return ok(`${n} sparkline${n === 1 ? '' : 's'} cleared`);
}

/* ---------- generic placed objects: shapes, diagrams, camera ---------- */
export interface ObjInfo { id: string; key: string; sheet: string; label: string; w: number; h: number }
const place = (e: Engine, key: string, data: unknown, w: number, h: number, anchor?: string): Out & { id?: string } => {
  const wb = wbOf(e); const ws = wb?.getActiveSheet(); if (!ws) return fail('No sheet');
  const at = anchor ? parseRef(e, anchor) : null; const used = ws.getDataRange().getRange(); const sel = at ?? { sheet: ws, r0: 0, c0: Math.min(used.endColumn + 2, 15000) }; // default: just right of the data so objects don't cover it
  const n = ws.getAllFloatDoms().length; const id = uid(key.replace('draco-', ''));
  const cell = ws.getRange(sel?.r0 ?? 1, sel?.c0 ?? 1, 1, 1);
  const r = ws.addFloatDomToRange(cell, { componentKey: key, data: data as never, allowTransform: true }, { width: w, height: h, marginX: 8 + (n % 6) * 22, marginY: 8 + (n % 6) * 22 }, id);
  return r ? { ...ok('Added'), id } : fail('The engine could not place the object here.');
};
export const addShape = (e: Engine, d: ShapeData, w = 160, h = 100, anchor?: string) => place(e, SHAPE_KEY, d, d.kind === 'icon' ? 64 : d.kind === 'line' ? 160 : w, d.kind === 'icon' ? 64 : d.kind === 'line' ? 60 : h, anchor);
export const addDiagram = (e: Engine, d: DiagramData, w = 460, h = 300, anchor?: string) => (d.text.trim() ? place(e, DIAGRAM_KEY, d, w, h, anchor) : fail('Type some text first.'));

export function cameraData(e: Engine, range: string): CamData | null {
  const l = parseRef(e, range); if (!l) return null;
  const disp = readDisplay(l); const rng = l.rng; const styles = rng.getCellStyles(); const bgs = rng.getBackgrounds(); const al = rng.getHorizontalAlignments();
  const grid: CamCell[][] = disp.map((row, r) => row.map((v, c) => { const st = styles[r]?.[c] as unknown as { bold?: boolean; italic?: boolean; fontColor?: string; color?: string } | null; const bg = bgs[r]?.[c]; const a = al[r]?.[c];
    return { v: String(v ?? ''), bold: !!st?.bold, italic: !!st?.italic, color: st?.fontColor ?? st?.color ?? undefined, bg: bg && /^#(?!fff(fff)?$)/i.test(bg) ? bg : undefined, align: a === 'center' || a === 'right' || a === 'left' ? a : undefined }; }));
  const colW = Array.from({ length: l.cols }, (_, c) => l.sheet.getColumnWidth(l.c0 + c)); const rowH = l.sheet.getRowHeight(l.r0);
  return { sheet: l.sheet.getSheetName(), range: `${a1(l.r0, l.c0)}:${a1(l.r0 + l.rows - 1, l.c0 + l.cols - 1)}`, grid, colW, rowH: rowH > 8 ? rowH : 22, showGrid: true };
}
export function addCamera(e: Engine, range?: string, anchor?: string): Out & { id?: string } {
  const loc = range ? parseRef(e, range) : targetLoc(e); if (!loc) return fail(`Range isn't valid: "${range ?? ''}"`);
  const rg = `${qsheet(loc.sheet.getSheetName())}!${a1(loc.r0, loc.c0)}:${a1(loc.r0 + loc.rows - 1, loc.c0 + loc.cols - 1)}`;
  const d = cameraData(e, rg); if (!d) return fail('Could not read that range');
  const total = (d.colW ?? []).reduce((a, b) => a + b, 0) || 300;
  return place(e, CAMERA_KEY, d, Math.min(700, total), Math.min(500, d.grid.length * (d.rowH ?? 22)), anchor);
}
export function refreshCameras(e: Engine): number {
  const wb = wbOf(e); if (!wb) return 0; let n = 0;
  for (const ws of wb.getSheets()) for (const f of ws.getAllFloatDoms()) {
    if (f?.componentKey !== CAMERA_KEY) continue; const d = f.data as unknown as CamData; const nd = cameraData(e, `${qsheet(d.sheet)}!${d.range}`); if (!nd) continue;
    const strip = (x: CamData) => JSON.stringify({ g: x.grid, s: x.showGrid }); if (strip(nd) !== strip(d) && replaceFloat(ws, f.id, CAMERA_KEY, { ...nd, colW: d.colW, rowH: d.rowH }, f.position)) n++;
  }
  return n;
}

export function listObjects(e: Engine, ...keys: string[]): ObjInfo[] {
  const wb = wbOf(e); if (!wb) return []; const out: ObjInfo[] = [];
  for (const ws of wb.getSheets()) for (const f of ws.getAllFloatDoms()) if (f && keys.includes(f.componentKey)) {
    const d = f.data as Record<string, unknown>; const label = f.componentKey === SHAPE_KEY ? `${(d.kind as string) === 'icon' ? 'Icon: ' + d.icon : (d.kind as string)}${d.text ? ' — ' + String(d.text).slice(0, 24) : ''}` : f.componentKey === DIAGRAM_KEY ? `${d.kind} — ${String(d.text).split('\n')[0].slice(0, 24)}` : f.componentKey === CAMERA_KEY ? `Picture of ${d.range}` : `Sparkline ${d.loc}`;
    out.push({ id: f.id, key: f.componentKey, sheet: ws.getSheetName(), label, w: Math.round(f.position.width ?? 0), h: Math.round(f.position.height ?? 0) });
  }
  return out;
}
export function updateObject(e: Engine, id: string, patch: { data?: Record<string, unknown>; w?: number; h?: number; at?: string }): Out {
  const wb = wbOf(e); if (!wb) return fail('No workbook');
  for (const ws of wb.getSheets()) { const f = ws.getFloatDomById(id); if (f) { let pos = { ...f.position, ...(patch.w ? { width: patch.w } : {}), ...(patch.h ? { height: patch.h } : {}) }; if (patch.at) { const l = parseRef(e, patch.at); if (!l) return fail(`Cell isn't valid: "${patch.at}"`); pos = { ...pos, ...cellOrigin(l.sheet, l.r0, l.c0) }; } const ok2 = replaceFloat(ws as WS, id, f.componentKey, { ...(f.data as object), ...(patch.data ?? {}) }, pos); return ok2 ? ok('Updated') : fail('Engine could not update the object'); } }
  return fail('Object not found');
}
export function removeObject(e: Engine, id: string): Out { const wb = wbOf(e); if (!wb) return fail('No workbook'); for (const ws of wb.getSheets()) if (ws.getFloatDomById(id)) { ws.removeFloatDom(id); return ok('Deleted'); } return fail('Object not found'); }
export function refreshObjects(e: Engine): number { return refreshSparklines(e) + refreshCameras(e); }

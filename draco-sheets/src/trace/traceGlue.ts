// Engine glue for trace arrows and spill references (v1.1.0).
import type { Engine } from '../engine';
import { a1 } from '../audit';
import { collectFormulas, nameMap, activeCell } from '../formulaTools';
import { cellOrigin, replaceFloat, type WS } from '../charts/chartGlue';
import { circleSvg, arrowSvg, dependentEdges, precedentEdges, rewriteSpillRefs } from './arrows';
import { ARROWS_KEY } from './ArrowsView';

const ids = new Map<string, string>(); // sheet name -> float id
export function clear(e: Engine): number {
  const wb = e.api.getActiveWorkbook(); if (!wb) return 0; let n = 0;
  for (const sh of wb.getSheets()) { const id = ids.get(sh.getSheetName()); if (id) { (sh as unknown as WS).removeFloatDom(id); ids.delete(sh.getSheetName()); n++; } }
  return n;
}
export function trace(e: Engine, mode: 'precedents' | 'dependents', deep: boolean): { ok: boolean; message: string; drawn: number } {
  const wb = e.api.getActiveWorkbook(); const cell = activeCell(e); if (!wb || !cell) return { ok: false, message: 'Select a cell first.', drawn: 0 };
  const all = collectFormulas(e), names = nameMap(e);
  const edges = mode === 'precedents' ? precedentEdges(cell, all, names, deep) : dependentEdges(cell, all, names, deep);
  const ws = wb.getActiveSheet() as unknown as WS; const sheet = ws.getSheetName();
  clear(e);
  const geo = (r: number, c: number) => { const o = cellOrigin(ws, r, c); return { x: o.left, y: o.top, w: ws.getColumnWidth(c), h: ws.getRowHeight(r) }; };
  const g = arrowSvg(edges, sheet, geo);
  const label = `${a1(cell.row, cell.col)}`;
  if (!edges.length) return { ok: true, message: mode === 'precedents' ? `${label} has no precedents.` : `No cells depend on ${label}.`, drawn: 0 };
  if (!g.drawn) return { ok: true, message: `All ${edges.length} link${edges.length === 1 ? '' : 's'} involve other sheets — use the list below to jump there.`, drawn: 0 };
  if (g.width > 6000 || g.height > 12000) return { ok: false, message: 'The linked cells are too far apart to draw. Use the list below.', drawn: 0 };
  const id = `trace_${Date.now().toString(36)}`; ids.set(sheet, id);
  const ok = replaceFloat(ws, id, ARROWS_KEY, { svg: g.svg, width: g.width, height: g.height }, { left: g.left, top: g.top, width: g.width, height: g.height });
  return { ok, message: `${g.drawn} arrow${g.drawn === 1 ? '' : 's'} drawn${g.otherSheet ? `; ${g.otherSheet} more go to other sheets` : ''}. Use "Remove arrows" to clear.`, drawn: g.drawn };
}
const circleIds = new Map<string, string>();
export function clearCircles(e: Engine): number { const wb = e.api.getActiveWorkbook(); if (!wb) return 0; let n = 0; for (const sh of wb.getSheets()) { const id = circleIds.get(sh.getSheetName()); if (id) { (sh as unknown as WS).removeFloatDom(id); circleIds.delete(sh.getSheetName()); n++; } } return n; }
/** Circle Invalid Data: ring every cell on the active sheet that breaks its data-validation rule. */
export async function circleInvalid(e: Engine): Promise<{ ok: boolean; message: string; cells: string[] }> {
  const wb = e.api.getActiveWorkbook(); if (!wb) return { ok: false, message: 'No workbook open.', cells: [] };
  const ws = wb.getActiveSheet(); const w = ws as unknown as WS & { getValidatorStatusAsync(): Promise<{ forValue(cb: (r: number, c: number, v: unknown) => void): void }>; getDataValidations(): unknown[] };
  clearCircles(e);
  if (!w.getDataValidations().length) return { ok: true, message: 'This sheet has no data-validation rules.', cells: [] };
  const st = await w.getValidatorStatusAsync(); const bad: Array<{ row: number; col: number }> = []; st.forValue((r, c, v) => { if (v === 'invalid') bad.push({ row: r, col: c }); });
  if (!bad.length) return { ok: true, message: '✔ Every cell satisfies its validation rule.', cells: [] };
  const shown = bad.slice(0, 500); const sheet = ws.getSheetName();
  const g = circleSvg(shown, (r, c) => { const o = cellOrigin(w, r, c); return { x: o.left, y: o.top, w: w.getColumnWidth(c), h: w.getRowHeight(r) }; });
  if (g.width > 8000 || g.height > 20000) return { ok: true, message: `${bad.length} invalid cell${bad.length === 1 ? '' : 's'}: ${bad.slice(0, 20).map((b) => a1(b.row, b.col)).join(', ')}… (too spread out to circle)`, cells: bad.map((b) => a1(b.row, b.col)) };
  const id = `circle_${Date.now().toString(36)}`; circleIds.set(sheet, id); replaceFloat(w, id, ARROWS_KEY, { svg: g.svg, width: g.width, height: g.height }, { left: g.left, top: g.top, width: g.width, height: g.height });
  return { ok: true, message: `${bad.length} invalid cell${bad.length === 1 ? '' : 's'} circled${bad.length > shown.length ? ` (first ${shown.length} drawn)` : ''}.`, cells: bad.map((b) => a1(b.row, b.col)) };
}
/** Rewrite `A1#` in a just-typed formula into a dynamic OFFSET block. Returns true if it changed the cell. */
export function fixSpillRefs(e: Engine, sheet?: string, row?: number, col?: number): boolean {
  const wb = e.api.getActiveWorkbook(); if (!wb) return false;
  const ws = sheet ? wb.getSheetByName(sheet) : wb.getActiveSheet(); if (!ws) return false;
  const rng = ws.getRange(row ?? 0, col ?? 0); const f = rng.getFormula(); if (!f || !f.startsWith('=') || !f.includes('#')) return false;
  const nf = rewriteSpillRefs(f); if (nf === f) return false; rng.setFormula(nf); return true;
}
export function install(w: Record<string, unknown>, e: () => Engine) {
  w.dracoTrace = { trace: (m: 'precedents' | 'dependents', deep = false) => trace(e(), m, deep), clear: () => clear(e()), circleInvalid: () => circleInvalid(e()), clearCircles: () => clearCircles(e()), fixSpill: (s?: string, r?: number, c?: number) => fixSpillRefs(e(), s, r, c) };
}

import type { Engine } from '../engine';
import { EXCEL_LIMITS, chunkPlan, genRows, a1End, type Step } from './perf';
const wbOf = (e: Engine) => e.api.getActiveWorkbook(); const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));
export function sheetSize(e: Engine) { const ws = wbOf(e)?.getActiveSheet(); return ws ? { rows: ws.getMaxRows(), cols: ws.getMaxColumns() } : { rows: 0, cols: 0 }; }
export function expandToExcelLimits(e: Engine) { const ws = wbOf(e)?.getActiveSheet(); if (!ws) return false; ws.setRowCount(EXCEL_LIMITS.rows); ws.setColumnCount(EXCEL_LIMITS.cols); return true; }
let cancel = false; export const cancelFill = () => { cancel = true; };
export async function fillTestData(e: Engine, o: { rows: number; cols: number; chunk?: number; at?: string; onProgress?: (done: number, total: number) => void }): Promise<{ ok: boolean; written: number; ms: number; message: string }> {
  const ws = wbOf(e)?.getActiveSheet(); const t0 = performance.now(); if (!ws) return { ok: false, written: 0, ms: 0, message: 'No sheet' }; cancel = false;
  if (ws.getMaxRows() < o.rows + 1) ws.setRowCount(Math.min(EXCEL_LIMITS.rows, o.rows + 1)); if (ws.getMaxColumns() < o.cols) ws.setColumnCount(Math.min(EXCEL_LIMITS.cols, o.cols));
  const header = Array.from({ length: o.cols }, (_, c) => ['Id', 'Code', 'Value', 'Region', 'Date', 'Amount'][c % 6] + (c >= 6 ? ` ${Math.floor(c / 6) + 1}` : '')); ws.getRange(0, 0, 1, o.cols).setValues([header]); let done = 0;
  for (const ch of chunkPlan(o.rows, o.chunk ?? 5000)) { if (cancel) return { ok: false, written: done, ms: Math.round(performance.now() - t0), message: `Stopped after ${done.toLocaleString('en-US')} rows` }; ws.getRange(1 + ch.start, 0, ch.count, o.cols).setValues(genRows(ch.start, ch.count, o.cols) as never); done += ch.count; o.onProgress?.(done, o.rows); await nextFrame(); }
  return { ok: true, written: done, ms: Math.round(performance.now() - t0), message: `Wrote ${done.toLocaleString('en-US')} rows × ${o.cols} columns` };
}
export async function benchmark(e: Engine, rows: number): Promise<Step[]> {
  const ws = wbOf(e)?.getActiveSheet(); if (!ws) return []; const steps: Step[] = []; const time = async (name: string, f: () => unknown | Promise<unknown>, note?: string) => { const t = performance.now(); await f(); steps.push({ name, ms: Math.round(performance.now() - t), note }); await nextFrame(); };
  const cols = 6; await time(`Write ${rows.toLocaleString('en-US')} × ${cols} cells (chunked)`, () => fillTestData(e, { rows, cols }));
  await time('Add a SUM over the Value column', () => { ws.getRange('H1').setFormula(`=SUM(C2:C${rows + 1})`); });
  await new Promise((r) => setTimeout(r, 600)); const v = ws.getRange('H1').getValue(); steps.push({ name: 'Formula result', ms: 0, note: String(v) });
  await time('Sort the data by Value (descending)', () => { (ws.getRange(1, 0, rows, cols) as unknown as { sort(o: object): unknown }).sort({ column: 2, ascending: false }); });
  await time('Jump to the last row', () => { ws.getRange(rows, 0).activate(); });
  await time('Read back the visible 50 rows', () => ws.getRange(rows - 50, 0, 50, cols).getValues());
  await time('Clear the test data', () => { ws.getRange('H1').clear(); ws.getRange(a1End(rows + 1, cols)).clear(); });
  return steps;
}
export function install(w: Record<string, unknown>, e: () => Engine) { w.dracoPerf = { size: () => sheetSize(e()), expand: () => expandToExcelLimits(e()), fill: (o: Parameters<typeof fillTestData>[1]) => fillTestData(e(), o), bench: (n: number) => benchmark(e(), n), cancel: cancelFill }; }

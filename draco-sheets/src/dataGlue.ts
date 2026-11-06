// Engine glue for data tools (v48, v50, v53, v56-v60): reads grids from the live workbook, applies the pure logic, writes results back.
import { bulk } from './perf/bulk';
import type { ColStats } from './perf/bulkCore';
import type { Engine } from './engine';
import {
  addSubtotals, advancedFilter, consolidate, currentRegion, flashFill, goalSeek, goToSpecial, parseDisplayNumber, removeDuplicates,
  removeSubtotals, splitText, tablePlan, toRanges, dataTable1, TABLE_STYLES, type ConsFn, type Grid, type SpecialKind,
} from './dataTools';
import { a1, colToNum } from './audit';
import { maxOf } from './safeMath';

type WB = NonNullable<ReturnType<Engine['api']['getActiveWorkbook']>>;
type WS = ReturnType<WB['getActiveSheet']>;
type RG = ReturnType<WS['getRange']>;
export interface Loc { sheet: WS; rng: RG; r0: number; c0: number; rows: number; cols: number }
export interface Out { ok: boolean; message: string }
const ok = (message: string): Out => ({ ok: true, message });
const fail = (message: string): Out => ({ ok: false, message });
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toLoc = (sheet: WS, rng: RG): Loc => { const r = rng.getRange(); return { sheet, rng, r0: r.startRow, c0: r.startColumn, rows: r.endRow - r.startRow + 1, cols: r.endColumn - r.startColumn + 1 }; };

/** Parse "A1", "A1:C5", "Sheet2!A1:C5", "'My Sheet'!A1" or a defined name. */
export function parseRef(e: Engine, text: string): Loc | null {
  const wb = wbOf(e); if (!wb) return null;
  let t = text.trim(); if (!t) return null;
  const named = wb.getDefinedNames().find((n) => n.getName().toLowerCase() === t.toLowerCase());
  if (named) t = named.getFormulaOrRefString();
  let sheet = wb.getActiveSheet();
  const bang = t.lastIndexOf('!');
  if (bang > 0) { const sn = t.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'"); const s = wb.getSheetByName(sn); if (!s) return null; sheet = s; t = t.slice(bang + 1); }
  t = t.replace(/\$/g, '');
  if (!/^[A-Za-z]{1,3}\d+(:[A-Za-z]{1,3}\d+)?$/.test(t)) return null;
  try { return toLoc(sheet, sheet.getRange(t.toUpperCase())); } catch { return null; }
}
export function selectionLoc(e: Engine): Loc | null {
  const wb = wbOf(e); const sh = wb?.getActiveSheet(); const r = sh?.getActiveRange();
  return sh && r ? toLoc(sh, r) : null;
}
/** Selection if it spans more than one cell, otherwise the contiguous region around the active cell (like Excel's tools do). */
export function targetLoc(e: Engine): Loc | null {
  const sel = selectionLoc(e); if (!sel) return null;
  if (sel.rows * sel.cols > 1) return sel;
  const used = sel.sheet.getDataRange(); const ur = used.getRange(); const vals = used.getValues() as Grid;
  const reg = currentRegion(vals, sel.r0 - ur.startRow, sel.c0 - ur.startColumn);
  if (!reg) return sel;
  return toLoc(sel.sheet, sel.sheet.getRange(ur.startRow + reg.r1, ur.startColumn + reg.c1, reg.r2 - reg.r1 + 1, reg.c2 - reg.c1 + 1));
}
/** The contiguous block around the active cell's top-left corner (what Excel's list-based tools such as Remove All Subtotals use). */
export function regionLoc(e: Engine): Loc | null {
  const sel = selectionLoc(e); if (!sel) return null;
  const used = sel.sheet.getDataRange(); const ur = used.getRange(); const vals = used.getValues() as Grid;
  const reg = currentRegion(vals, sel.r0 - ur.startRow, sel.c0 - ur.startColumn);
  if (!reg) return sel;
  return toLoc(sel.sheet, sel.sheet.getRange(ur.startRow + reg.r1, ur.startColumn + reg.c1, reg.r2 - reg.r1 + 1, reg.c2 - reg.c1 + 1));
}
export const readValues = (l: Loc): Grid => l.rng.getValues() as Grid;
export const readDisplay = (l: Loc): Grid => l.rng.getDisplayValues() as Grid;
export const readFormulas = (l: Loc): Grid => l.rng.getFormulas() as Grid;
const isF = (v: unknown): v is string => typeof v === 'string' && v.startsWith('=');

/** Write a grid at (r0,c0). Cells that are strings starting with "=" become formulas. */
export function writeGrid(sheet: WS, r0: number, c0: number, g: Grid): void {
  if (!g.length) return;
  const w = maxOf(g.map((r) => r.length));
  const vals = g.map((r) => Array.from({ length: w }, (_, j) => (isF(r[j]) ? null : (r[j] ?? null))));
  for (let i = 0; i < vals.length; i += 20000) sheet.getRange(r0 + i, c0, Math.min(20000, vals.length - i), w).setValues(vals.slice(i, i + 20000) as never); // chunked: one giant mutation stalls the page
  g.forEach((r, i) => r.forEach((v, j) => { if (isF(v)) sheet.getRange(r0 + i, c0 + j).setFormula(v); }));
}
const settle = async (e: Engine, op: () => void, ms = 1500) => {
  const p = e.api.getFormula().onCalculationResultApplied(ms).catch(() => undefined);
  op(); await p; await sleep(20);
};

/* ---- v50 Go To / Go To Special ---- */
export function goTo(e: Engine, text: string): Out {
  const wb = wbOf(e); const l = parseRef(e, text); if (!wb || !l) return fail(`Reference isn't valid: "${text}"`);
  wb.setActiveSheet(l.sheet); l.rng.activate(); return ok(`Went to ${l.sheet.getSheetName()}!${text.toUpperCase()}`);
}
export function selectRanges(e: Engine, sheet: WS, ranges: string[]): boolean {
  const wb = wbOf(e); if (!wb || !ranges.length) return false;
  const rects = ranges.map((a) => sheet.getRange(a).getRange());
  try {
    void e.api.executeCommand('sheet.operation.set-selections', {
      unitId: wb.getId(), subUnitId: sheet.getSheetId(),
      selections: rects.map((r, i) => ({
        range: { startRow: r.startRow, endRow: r.endRow, startColumn: r.startColumn, endColumn: r.endColumn, rangeType: 0 },
        primary: i === rects.length - 1 ? { startRow: r.startRow, endRow: r.endRow, startColumn: r.startColumn, endColumn: r.endColumn, actualRow: r.startRow, actualColumn: r.startColumn, isMerged: false, isMergedMainCell: false } : null,
        style: null,
      })),
    });
    return true;
  } catch { sheet.getRange(ranges[0]).activate(); return false; }
}
export function goToSpecialRun(e: Engine, kind: SpecialKind, scope: 'selection' | 'sheet'): Out & { ranges: string[]; count: number } {
  const sel = selectionLoc(e); if (!sel) return { ...fail('Select a cell first.'), ranges: [], count: 0 };
  let l = sel;
  if (scope === 'sheet' || sel.rows * sel.cols === 1) { const used = sel.sheet.getDataRange(); l = toLoc(sel.sheet, used); }
  const cells = goToSpecial(readDisplay(l), readFormulas(l), kind);
  const ranges = toRanges(cells, l.r0, l.c0);
  if (!cells.length) return { ...fail('No cells were found.'), ranges: [], count: 0 };
  const multi = selectRanges(e, l.sheet, ranges);
  return { ...ok(`${cells.length} cell${cells.length === 1 ? '' : 's'} found in ${ranges.length} range${ranges.length === 1 ? '' : 's'}${multi ? ' and selected' : ' (first range selected)'}.`), ranges, count: cells.length };
}

/* ---- v53 Remove Duplicates / Text to Columns / Flash Fill ---- */
export function dedupeRun(e: Engine, keyCols: number[], hasHeader: boolean, caseSensitive: boolean): Out {
  const l = targetLoc(e); if (!l) return fail('Select a range first.');
  const vals = readDisplay(l), forms = readFormulas(l);
  const res = removeDuplicates(vals, { cols: keyCols, hasHeader, caseSensitive });
  if (!res.removed) return ok('No duplicate values found.');
  const drop = new Set(res.removedRows);
  const keep = vals.map((_, i) => i).filter((i) => !drop.has(i));
  const raw = l.rng.getValues() as Grid;
  const out: Grid = keep.map((i) => raw[i].map((v, j) => (isF(forms[i][j]) ? forms[i][j] : v)));
  writeGrid(l.sheet, l.r0, l.c0, out);
  l.sheet.getRange(l.r0 + out.length, l.c0, res.removed, l.cols).clearContent();
  return ok(`${res.removed} duplicate value${res.removed === 1 ? '' : 's'} found and removed; ${keep.length - (hasHeader ? 1 : 0)} unique value${keep.length - (hasHeader ? 1 : 0) === 1 ? '' : 's'} remain.`);
}
export const BULK_ASYNC_ROWS = 20_000;
/** Same as dedupeRun, but the comparison runs in a background worker so the page stays responsive on big ranges. */
export async function dedupeRunAsync(e: Engine, keyCols: number[], hasHeader: boolean, caseSensitive: boolean): Promise<Out> {
  const l = targetLoc(e); if (!l) return fail('Select a range first.');
  if (l.rows < BULK_ASYNC_ROWS) return dedupeRun(e, keyCols, hasHeader, caseSensitive);
  const vals = readDisplay(l), forms = readFormulas(l);
  const res = await bulk<{ op: 'dedupe'; removedRows: number[]; removed: number }>({ op: 'dedupe', rows: vals, cols: keyCols, hasHeader, caseSensitive });
  if (!res.removed) return ok('No duplicate values found.');
  const drop = new Set(res.removedRows); const keep: number[] = []; for (let i = 0; i < vals.length; i++) if (!drop.has(i)) keep.push(i);
  const raw = l.rng.getValues() as Grid; const out: Grid = keep.map((i) => raw[i].map((v, j) => (isF(forms[i][j]) ? forms[i][j] : v)));
  writeGrid(l.sheet, l.r0, l.c0, out); l.sheet.getRange(l.r0 + out.length, l.c0, res.removed, l.cols).clearContent();
  return ok(`${res.removed} duplicate value${res.removed === 1 ? '' : 's'} found and removed; ${keep.length - (hasHeader ? 1 : 0)} unique value${keep.length - (hasHeader ? 1 : 0) === 1 ? '' : 's'} remain.`);
}
/** Per-column statistics for the selection (or a given range), computed in the background worker. */
export async function columnStatsRun(e: Engine, ref?: string): Promise<Out & { stats?: ColStats[] }> {
  const l = ref ? parseRef(e, ref) : targetLoc(e); if (!l) return fail('Select a range first.');
  const g = readDisplay(l); const cols = Array.from({ length: l.cols }, (_, c) => g.map((r) => r[c]));
  const r = await bulk<{ op: 'stats'; stats: ColStats[] }>({ op: 'stats', cols }); return { ...ok(`Statistics for ${l.cols} column${l.cols === 1 ? '' : 's'}, ${l.rows} rows.`), stats: r.stats };
}
export function textToColumnsRun(e: Engine, delim: string, merge: boolean, qualifier: string, overwrite: boolean): Out {
  const l = selectionLoc(e); if (!l) return fail('Select the cells to split.');
  if (l.cols > 1) return fail('Select a single column to split.');
  const src = readValues(l).map((r) => String(r[0] ?? ''));
  const parts = src.map((t) => splitText(t, { delim, merge, qualifier }));
  const width = maxOf(parts.map((p) => p.length), [1]);
  if (width === 1) return ok('Nothing to split: the delimiter was not found.');
  const dest = l.sheet.getRange(l.r0, l.c0 + 1, l.rows, width - 1);
  if (!overwrite && (dest.getValues() as Grid).some((r) => r.some((v) => v !== null && v !== undefined && v !== ''))) return fail('There is already data to the right. Tick "Overwrite" to replace it.');
  const grid: Grid = parts.map((p) => Array.from({ length: width }, (_, j) => (p[j] !== undefined ? (p[j] !== '' && Number.isFinite(Number(p[j])) ? Number(p[j]) : p[j]) : null)));
  writeGrid(l.sheet, l.r0, l.c0, grid);
  return ok(`Split ${l.rows} cell${l.rows === 1 ? '' : 's'} into ${width} columns.`);
}
export function flashFillRun(e: Engine): Out {
  const wb = wbOf(e); const sh = wb?.getActiveSheet(); const act = sh?.getActiveRange();
  if (!sh || !act) return fail('Select a cell in the output column.');
  const ar = act.getRange(); const outCol = ar.startColumn;
  if (outCol === 0) return fail('Flash Fill needs input data in the column to the left.');
  const used = sh.getDataRange(); const ur = used.getRange(); const all = used.getDisplayValues() as Grid;
  const inCol = outCol - 1; const get = (r: number, c: number) => String(all[r - ur.startRow]?.[c - ur.startColumn] ?? '');
  // contiguous block of input rows around the active row
  let top = ar.startRow, bot = ar.startRow;
  while (top > ur.startRow && get(top - 1, inCol) !== '') top--;
  while (bot < ur.endRow && get(bot + 1, inCol) !== '') bot++;
  const examples: Array<[string, string]> = []; const targets: number[] = [];
  for (let r = top; r <= bot; r++) { const o = get(r, outCol), i = get(r, inCol); if (!i) continue; if (o !== '') examples.push([i, o]); else targets.push(r); }
  if (!examples.length) return fail('Type an example result next to the first row, then run Flash Fill.');
  if (!targets.length) return ok('Nothing to fill: every row already has a value.');
  const res = flashFill(examples, targets.map((r) => get(r, inCol)));
  if (!res.confident) return fail('Could not find a pattern that fits all your examples. Add another example.');
  targets.forEach((r, i) => { const v = res.outputs[i]; if (v !== null) sh.getRange(r, outCol).setValue(v); });
  const skipped = res.outputs.filter((v) => v === null).length;
  return ok(`Filled ${targets.length - skipped} cell${targets.length - skipped === 1 ? '' : 's'} using: ${res.program}${skipped ? ` (${skipped} skipped: pattern did not fit)` : ''}.`);
}

/* ---- v48 Advanced Filter ---- */
export function advancedFilterRun(e: Engine, listRef: string, critRef: string, action: 'inplace' | 'copy', destRef: string, unique: boolean): Out {
  const list = parseRef(e, listRef), crit = parseRef(e, critRef);
  if (!list) return fail('List range is not valid.'); if (!crit) return fail('Criteria range is not valid.');
  const res = advancedFilter(readDisplay(list), readDisplay(crit), { uniqueOnly: unique });
  if (action === 'copy') {
    const dest = parseRef(e, destRef); if (!dest) return fail('Copy-to location is not valid.');
    writeGrid(dest.sheet, dest.r0, dest.c0, res.rows);
    return ok(`${res.matches.length} record${res.matches.length === 1 ? '' : 's'} copied to ${destRef.toUpperCase()}.`);
  }
  const first = list.r0 + 1; const n = list.rows - 1;
  if (n > 0) list.sheet.showRows(first, n);
  const keep = new Set(res.matches);
  for (let i = 1; i < list.rows; i++) if (!keep.has(i)) list.sheet.hideRows(list.r0 + i, 1);
  return ok(`${res.matches.length} of ${n} record${n === 1 ? '' : 's'} found.`);
}
export function advancedFilterReset(e: Engine, listRef: string): Out {
  const list = parseRef(e, listRef); if (!list) return fail('List range is not valid.');
  list.sheet.showRows(list.r0, list.rows); return ok('All rows shown.');
}

/* ---- v56 Subtotals ---- */
export function subtotalRun(e: Engine, groupCol: number, sumCols: number[], fn: 9 | 1 | 2 | 4 | 5 | 6): Out {
  const l = targetLoc(e); if (!l) return fail('Select the data range (with a header row).');
  if (l.rows < 2) return fail('Need a header row and at least one data row.');
  if (!sumCols.length) return fail('Choose at least one column to subtotal.');
  const forms = readFormulas(l), raw = readValues(l);
  if (forms.some((r) => r.some((c) => isF(c) && /SUBTOTAL\(/i.test(c)))) return fail('This range already has subtotals. Remove them first.');
  const data: Grid = raw.map((r, i) => r.map((v, j) => (isF(forms[i][j]) ? forms[i][j] : v)));
  const { grid, subtotalRows } = addSubtotals(data, l.r0, l.c0, { groupCol, sumCols, fn });
  const extra = grid.length - l.rows;
  l.sheet.insertRowsAfter(l.r0 + l.rows - 1, extra);
  writeGrid(l.sheet, l.r0, l.c0, grid);
  subtotalRows.forEach((i) => l.sheet.getRange(l.r0 + i, l.c0, 1, l.cols).setFontWeight('bold'));
  l.sheet.getRange(l.r0, l.c0, grid.length, l.cols).activate(); // inserting rows moves the selection; keep the whole block selected
  return ok(`Inserted ${subtotalRows.length} subtotal row${subtotalRows.length === 1 ? '' : 's'} (including the grand total).`);
}
export function removeSubtotalsRun(e: Engine): Out {
  const l = regionLoc(e); if (!l) return fail('Click a cell inside the subtotaled list.');
  const rows = removeSubtotals(readFormulas(l), readValues(l));
  if (!rows.length) return ok('No subtotals found.');
  [...rows].sort((a, b) => b - a).forEach((i) => l.sheet.deleteRow(l.r0 + i));
  return ok(`Removed ${rows.length} subtotal row${rows.length === 1 ? '' : 's'}.`);
}

/* ---- v57/v58 Format as Table ---- */
export function formatAsTableRun(e: Engine, styleIdx: number, o: { banded: boolean; totalRow: boolean; filter: boolean }): Out {
  const l = targetLoc(e); if (!l) return fail('Select the data range.');
  if (l.rows < 2) return fail('A table needs a header row and at least one data row.');
  const st = TABLE_STYLES[styleIdx] ?? TABLE_STYLES[0]; const plan = tablePlan(l.rows, st, { banded: o.banded, totalRow: o.totalRow });
  plan.forEach((p, i) => {
    const r = l.sheet.getRange(l.r0 + i, l.c0, 1, l.cols);
    r.setBackground(p.bg).setFontColor(p.fg ?? '#000000').setFontWeight(p.bold ? 'bold' : 'normal');
  });
  l.rng.setBorder(e.api.Enum.BorderType.OUTSIDE, e.api.Enum.BorderStyleTypes.THIN, st.border);
  l.sheet.getRange(l.r0, l.c0, 1, l.cols).setBorder(e.api.Enum.BorderType.BOTTOM, e.api.Enum.BorderStyleTypes.MEDIUM, st.border);
  if (o.filter && !l.sheet.getFilter()) l.rng.createFilter();
  return ok(`Formatted ${l.rows - 1} row${l.rows === 2 ? '' : 's'} as a ${st.name.toLowerCase()} table${o.filter ? ' with filter buttons' : ''}.`);
}
export function clearTableRun(e: Engine): Out {
  const l = targetLoc(e); if (!l) return fail('Select the table.');
  l.rng.setBackground('#ffffff').setFontColor('#000000').setFontWeight('normal');
  l.sheet.getFilter()?.remove(); return ok('Table formatting cleared.');
}

/* ---- v59/v60 What-if ---- */
const numAt = (l: Loc): number => parseDisplayNumber(l.rng.getValue());
export async function goalSeekRun(e: Engine, setRef: string, toValue: number, changeRef: string): Promise<Out> {
  const setL = parseRef(e, setRef), chgL = parseRef(e, changeRef);
  if (!setL || setL.rows * setL.cols !== 1) return fail('"Set cell" must be a single cell.');
  if (!chgL || chgL.rows * chgL.cols !== 1) return fail('"By changing cell" must be a single cell.');
  if (!isF(setL.rng.getFormula())) return fail('"Set cell" must contain a formula.');
  if (isF(chgL.rng.getFormula())) return fail('"By changing cell" must contain a value, not a formula.');
  const orig = chgL.rng.getValue(); const x0 = parseDisplayNumber(orig);
  const start = Number.isFinite(x0) ? x0 : 0;
  let bad = false;
  const evaluate = async (x: number) => { await settle(e, () => chgL.rng.setValue(x)); const y = numAt(setL); if (!Number.isFinite(y)) bad = true; return y; };
  const r = await goalSeek(evaluate, toValue, start);
  if (r.converged) { await settle(e, () => chgL.rng.setValue(r.x)); return ok(`Goal Seeking found a solution: ${changeRef.toUpperCase()} = ${+r.x.toPrecision(10)} (result ${+r.fx.toPrecision(10)}, ${r.iterations} tries).`); }
  await settle(e, () => chgL.rng.setValue(orig as never));
  return fail(bad ? 'The Set cell does not evaluate to a number.' : `Goal Seeking could not find a solution for ${toValue} (closest result ${+r.fx.toPrecision(6)}). The original value was restored.`);
}
export async function dataTableRun(e: Engine, inputRef: string, formulaRef: string): Promise<Out> {
  const vals = selectionLoc(e); const inp = parseRef(e, inputRef), fl = parseRef(e, formulaRef);
  if (!vals || vals.cols !== 1 || vals.rows < 1) return fail('Select a single column of input values first.');
  if (!inp || inp.rows * inp.cols !== 1) return fail('Column input cell must be a single cell.');
  if (!fl || !isF(fl.rng.getFormula())) return fail('Formula cell must contain a formula.');
  const xs = (readValues(vals).map((r) => parseDisplayNumber(r[0])));
  if (xs.some((x) => !Number.isFinite(x))) return fail('Every selected input value must be a number.');
  const orig = inp.rng.getValue();
  const ys = await dataTable1(xs, async (x) => { await settle(e, () => inp.rng.setValue(x)); return numAt(fl); });
  await settle(e, () => inp.rng.setValue(orig as never));
  vals.sheet.getRange(vals.r0, vals.c0 + 1, ys.length, 1).setValues(ys.map((y) => [y]) as never);
  return ok(`Filled ${ys.length} result${ys.length === 1 ? '' : 's'} in the next column.`);
}
export interface Scenario { name: string; cells: Record<string, number | string> }
const scKey = (e: Engine) => `draco:scenarios:${wbOf(e)?.getId() ?? ''}`;
export const loadScenarios = (e: Engine): Scenario[] => { try { return JSON.parse(localStorage.getItem(scKey(e)) ?? '[]'); } catch { return []; } };
const saveScenarios = (e: Engine, s: Scenario[]) => { try { localStorage.setItem(scKey(e), JSON.stringify(s)); } catch { /* storage unavailable */ } };
export function scenarioSave(e: Engine, name: string, cellsRef: string): Out {
  if (!name.trim()) return fail('Give the scenario a name.');
  const refs = cellsRef.split(/[,;\s]+/).filter(Boolean); if (!refs.length) return fail('List the changing cells, e.g. B1, B2.');
  const cells: Scenario['cells'] = {};
  for (const r of refs) { const l = parseRef(e, r); if (!l || l.rows * l.cols !== 1) return fail(`"${r}" is not a single cell.`); const v = l.rng.getValue(); cells[`${l.sheet.getSheetName()}!${r.toUpperCase()}`] = (v ?? '') as number | string; }
  const list = loadScenarios(e).filter((s) => s.name.toLowerCase() !== name.trim().toLowerCase());
  saveScenarios(e, [...list, { name: name.trim(), cells }]); return ok(`Scenario "${name.trim()}" saved with ${refs.length} cell${refs.length === 1 ? '' : 's'}.`);
}
export async function scenarioShow(e: Engine, name: string): Promise<Out> {
  const s = loadScenarios(e).find((x) => x.name === name); if (!s) return fail('Scenario not found.');
  await settle(e, () => { for (const [ref, v] of Object.entries(s.cells)) parseRef(e, ref)?.rng.setValue(v as never); });
  return ok(`Showing scenario "${name}".`);
}
export function scenarioDelete(e: Engine, name: string): Out { saveScenarios(e, loadScenarios(e).filter((s) => s.name !== name)); return ok(`Deleted "${name}".`); }

/* ---- v59 Consolidate ---- */
export function consolidateRun(e: Engine, refs: string[], fn: ConsFn, mode: 'position' | 'labels', destRef: string): Out {
  const blocks: Grid[] = [];
  for (const r of refs.map((x) => x.trim()).filter(Boolean)) { const l = parseRef(e, r); if (!l) return fail(`Reference isn't valid: "${r}"`); blocks.push(readValues(l)); }
  if (blocks.length < 1) return fail('Add at least one source range.');
  const dest = parseRef(e, destRef); if (!dest) return fail('Destination is not valid.');
  const out = consolidate(blocks, fn, mode);
  writeGrid(dest.sheet, dest.r0, dest.c0, out);
  return ok(`Consolidated ${blocks.length} range${blocks.length === 1 ? '' : 's'} into ${out.length} row${out.length === 1 ? '' : 's'} at ${destRef.toUpperCase()}.`);
}
export const colName = (c: number) => a1(0, c).replace(/\d+/g, '');
export { colToNum };

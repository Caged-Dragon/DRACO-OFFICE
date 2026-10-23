// Engine glue for formula tools (v41, v43-v45).
import type { Engine } from './engine';
import { a1, findCircular, isErrorValue, type FormulaCell } from './audit';

export interface ErrorCell { sheet: string; row: number; col: number; value: string; formula: string }
export interface NameRow { name: string; ref: string; comment: string }

const wbOf = (e: Engine) => e.api.getActiveWorkbook();

export function collectFormulas(e: Engine): FormulaCell[] {
  const wb = wbOf(e); if (!wb) return [];
  const out: FormulaCell[] = [];
  for (const sh of wb.getSheets()) {
    const rng = sh.getDataRange(); const base = rng.getRange();
    const f = rng.getFormulas();
    f.forEach((line, i) => line.forEach((s, j) => { if (s && s.startsWith('=')) out.push({ sheet: sh.getSheetName(), row: base.startRow + i, col: base.startColumn + j, formula: s }); }));
  }
  return out;
}

export function collectErrors(e: Engine): ErrorCell[] {
  const wb = wbOf(e); if (!wb) return [];
  const out: ErrorCell[] = [];
  for (const sh of wb.getSheets()) {
    const rng = sh.getDataRange(); const base = rng.getRange();
    const vals = rng.getDisplayValues(); const forms = rng.getFormulas();
    vals.forEach((line, i) => line.forEach((v, j) => { if (isErrorValue(v)) out.push({ sheet: sh.getSheetName(), row: base.startRow + i, col: base.startColumn + j, value: v, formula: forms[i]?.[j] ?? '' }); }));
  }
  return out;
}

export function nameMap(e: Engine): Record<string, string> {
  const wb = wbOf(e); if (!wb) return {};
  return Object.fromEntries(wb.getDefinedNames().map((n) => [n.getName(), n.getFormulaOrRefString()]));
}
export function listNames(e: Engine): NameRow[] {
  const wb = wbOf(e); if (!wb) return [];
  return wb.getDefinedNames().map((n) => ({ name: n.getName(), ref: n.getFormulaOrRefString(), comment: n.getComment() ?? '' }));
}
const quoteSheet = (s: string) => (/^[A-Za-z_]\w*$/.test(s) ? s : `'${s.replace(/'/g, "''")}'`);

export function selectionRef(e: Engine): string {
  const sh = wbOf(e)?.getActiveSheet(); const r = sh?.getActiveRange()?.getRange();
  if (!sh || !r) return '';
  const abs = (row: number, col: number) => `$${a1(row, col).replace(/\d+$/, '')}$${row + 1}`;
  const body = r.startRow === r.endRow && r.startColumn === r.endColumn ? abs(r.startRow, r.startColumn) : `${abs(r.startRow, r.startColumn)}:${abs(r.endRow, r.endColumn)}`;
  return `${quoteSheet(sh.getSheetName())}!${body}`;
}

const CELL_LIKE = /^[A-Za-z]{1,3}\d+$/;
export function validateName(name: string, existing: string[], editing?: string): string | null {
  if (!name) return 'Enter a name.';
  if (!/^[A-Za-z_\\][\w.]*$/.test(name)) return 'Names must start with a letter or _ and contain only letters, numbers, . and _.';
  if (CELL_LIKE.test(name) || /^R\d*C\d*$/i.test(name)) return 'That name looks like a cell reference.';
  if (name.length > 255) return 'Name is too long.';
  if (existing.some((n) => n.toLowerCase() === name.toLowerCase() && n.toLowerCase() !== editing?.toLowerCase())) return 'That name already exists.';
  return null;
}

export function saveName(e: Engine, name: string, ref: string, comment: string, editing?: string): void {
  const wb = wbOf(e); if (!wb) return;
  if (editing) wb.deleteDefinedName(editing);
  const b = wb.newDefinedNameBuilder().setName(name).setComment(comment);
  if (ref.trim().startsWith('=')) b.setFormula(ref.trim().slice(1)); else b.setRef(ref.trim());
  wb.insertDefinedNameBuilder(b.build());
}
export const removeName = (e: Engine, name: string) => { wbOf(e)?.deleteDefinedName(name); };

export function jumpTo(e: Engine, sheetName: string, row: number, col: number): void {
  const wb = wbOf(e); if (!wb) return;
  const sh = wb.getSheetByName(sheetName); if (!sh) return;
  wb.setActiveSheet(sh);
  sh.getRange(row, col).activate();
}
export function activeCell(e: Engine): { sheet: string; row: number; col: number } | null {
  const sh = wbOf(e)?.getActiveSheet(); const r = sh?.getActiveRange()?.getRange();
  return sh && r ? { sheet: sh.getSheetName(), row: r.startRow, col: r.startColumn } : null;
}
export function cellInfo(e: Engine, sheet: string, row: number, col: number): { value: string; formula: string } {
  const sh = wbOf(e)?.getSheetByName(sheet); if (!sh) return { value: '#REF!', formula: '' };
  const r = sh.getRange(row, col);
  return { value: r.getDisplayValue(), formula: r.getFormula() };
}
export const calculateNow = (e: Engine) => e.api.getFormula().executeCalculation();
export const stopCalculation = (e: Engine) => e.api.getFormula().stopCalculation();

export const circularCells = (e: Engine) => findCircular(collectFormulas(e), nameMap(e));

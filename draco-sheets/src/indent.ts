import type { Engine } from './engine';

export const INDENT_STEP = 10; // px of left padding per indent level

/** Excel-style Increase/Decrease Indent (v13). Applies to the whole active selection, based on its first cell. */
export async function changeIndent(engine: Engine, delta: 1 | -1): Promise<boolean> {
  const api = engine.api;
  const wb = api.getActiveWorkbook();
  const sh = wb?.getActiveSheet();
  const fr = sh?.getActiveRange();
  if (!wb || !sh || !fr) return false;
  const range = fr.getRange();
  const cur = (fr.getCellStyleData() as { pd?: { l?: number } } | null)?.pd?.l ?? 0;
  const next = Math.max(0, cur + delta * INDENT_STEP);
  await api.executeCommand('sheet.command.set-range-values', {
    unitId: wb.getId(),
    subUnitId: sh.getSheetId(),
    range: { startRow: range.startRow, endRow: range.endRow, startColumn: range.startColumn, endColumn: range.endColumn },
    value: { s: { pd: { l: next } } },
  });
  return true;
}

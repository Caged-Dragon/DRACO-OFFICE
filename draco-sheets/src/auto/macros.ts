// Macros-lite (v93): recorded mutation lists, retargeting, merging, describing, export. Pure.
export interface Op { id: string; params: Record<string, unknown> }
export interface Macro { id: string; name: string; at: string; relative: boolean; anchor: { r: number; c: number }; ops: Op[]; note?: string }
export const uidM = () => 'm' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const SKIP = /toggle-note-popup|set-selections|scroll|zoom|set-worksheet-active|protection|permission|mark-dirty|mutation\.empty|mutation\.ts$|insert-sheet|remove-sheet|set-worksheet-name|set-worksheet-order|copy-worksheet|set-workbook/;
export function recordable(id: string, options?: Record<string, unknown>): boolean {
  if (options && (options.onlyLocal || options.fromCollab || options.fromChangeset || options.fromSync || options.fromFormula)) return false;
  return id.startsWith('sheet.mutation.') && !SKIP.test(id);
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
type CV = Record<string, Record<string, unknown>>;
/** Merge a new op into the list: consecutive set-range-values for one sheet collapse (later cells win). */
export function pushOp(ops: Op[], op: Op): Op[] {
  const last = ops[ops.length - 1];
  if (last && last.id === 'sheet.mutation.set-range-values' && op.id === last.id && last.params.subUnitId === op.params.subUnitId && last.params.cellValue && op.params.cellValue) {
    const cv = clone(last.params.cellValue as CV); for (const [r, row] of Object.entries(op.params.cellValue as CV)) { cv[r] = cv[r] ?? {}; for (const [c, cell] of Object.entries(row)) cv[r][c] = { ...((cv[r][c] ?? {}) as object), ...(clone(cell) as object) } as never; }
    return ops.slice(0, -1).concat({ id: last.id, params: { ...clone(op.params), cellValue: cv } });
  }
  return ops.concat({ id: op.id, params: clone(op.params) });
}
const isRange = (o: unknown): o is { startRow: number; endRow: number; startColumn: number; endColumn: number; rangeType?: number } => !!o && typeof o === 'object' && 'startRow' in (o as object) && 'endRow' in (o as object) && 'startColumn' in (o as object);
const shiftKeys = (obj: Record<string, unknown>, d: number): Record<string, unknown> => { const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(obj)) { const n = +k + d; if (n >= 0) out[String(n)] = v; } return out; };
function walk(x: unknown, dr: number, dc: number): unknown {
  if (Array.isArray(x)) return x.map((v) => walk(v, dr, dc));
  if (!x || typeof x !== 'object') return x;
  if (isRange(x)) { const t = x.rangeType ?? 0; const r = { ...(x as object) } as typeof x; if (t !== 2) { r.startRow = Math.max(0, x.startRow + dr); r.endRow = Math.max(0, x.endRow + dr); } if (t !== 1) { r.startColumn = Math.max(0, x.startColumn + dc); r.endColumn = Math.max(0, x.endColumn + dc); } return r; }
  const o = x as Record<string, unknown>; const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'cellValue' && v && typeof v === 'object') { const rows = shiftKeys(v as Record<string, unknown>, dr); const res: Record<string, unknown> = {}; for (const [r, row] of Object.entries(rows)) res[r] = shiftKeys(row as Record<string, unknown>, dc); out[k] = res; }
    else if (k === 'rowInfo' || k === 'rowData') out[k] = shiftKeys(v as Record<string, unknown>, dr);
    else if (k === 'colInfo' || k === 'colData') out[k] = shiftKeys(v as Record<string, unknown>, dc);
    else out[k] = walk(v, dr, dc);
  }
  return out;
}
/** Point an op at the current workbook/sheet and shift it by (dr, dc). */
export function retarget(op: Op, to: { unitId: string; subUnitId: string; dr: number; dc: number }): Op {
  const params = walk(clone(op.params), to.dr, to.dc) as Record<string, unknown>; if ('unitId' in params) params.unitId = to.unitId; if ('subUnitId' in params) params.subUnitId = to.subUnitId; return { id: op.id, params };
}
const colName = (c: number) => { let s = '', n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const a1 = (r: number, c: number) => `${colName(c)}${r + 1}`;
export function describeOp(op: Op): string {
  const p = op.params; const id = op.id.replace('sheet.mutation.', '');
  if (id === 'set-range-values' && p.cellValue) { let n = 0, r0 = 1e9, c0 = 1e9, r1 = -1, c1 = -1; let styled = 0, formulas = 0; for (const [r, row] of Object.entries(p.cellValue as CV)) for (const [c, cell] of Object.entries(row)) { n++; r0 = Math.min(r0, +r); r1 = Math.max(r1, +r); c0 = Math.min(c0, +c); c1 = Math.max(c1, +c); const cc = cell as { s?: unknown; f?: unknown }; if (cc.s) styled++; if (cc.f) formulas++; } return `Set ${n} cell${n === 1 ? '' : 's'} (${n ? (r0 === r1 && c0 === c1 ? a1(r0, c0) : `${a1(r0, c0)}:${a1(r1, c1)}`) : ''})${formulas ? `, ${formulas} formula${formulas === 1 ? '' : 's'}` : ''}${styled ? `, ${styled} formatted` : ''}`; }
  return id.replace(/-/g, ' ').replace(/^./, (m) => m.toUpperCase());
}
export const countCells = (m: Macro) => m.ops.reduce((a, o) => a + (o.params.cellValue ? Object.values(o.params.cellValue as CV).reduce((b, row) => b + Object.keys(row).length, 0) : 0), 0);
export function newMacro(o: { name: string; relative: boolean; anchor: { r: number; c: number }; ops: Op[] }): Macro { return { id: uidM(), name: o.name.trim() || 'Macro', at: new Date().toISOString(), relative: o.relative, anchor: o.anchor, ops: o.ops }; }
/** A script that replays the macro (relative macros are shifted by the selection like in the dialog). */
export function macroToScript(m: Macro): string { return `// Recorded macro "${m.name}" (${m.ops.length} step${m.ops.length === 1 ? '' : 's'})\nconst ops = ${JSON.stringify(m.ops)};\nawait draco.replay(ops, { relative: ${m.relative}, anchor: ${JSON.stringify(m.anchor)} });\n`; }
export const macrosOk = (x: unknown): x is Macro[] => Array.isArray(x) && x.every((m) => m && typeof m.id === 'string' && Array.isArray(m.ops));

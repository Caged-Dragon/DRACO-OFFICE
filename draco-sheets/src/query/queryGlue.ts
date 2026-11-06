// Engine glue for Power-Query-lite (v78): saved queries that import, transform and load a table into a sheet.
import type { Engine } from '../engine';
import { parseRef, readValues, type Out } from '../dataGlue';
import { a1 } from '../audit';
import { registerResource } from '../persist';
import { parseDelimited, runQuery, tableFromGrid, tableFromJson, type Resolver, type Step, type Table } from './query';
import type { Cell } from '../pivot/pivot';

import { sniffFormat, htmlTable, typed } from '../links/links';
export type QuerySource = { kind: 'sheet'; ref: string } | { kind: 'csv'; text: string } | { kind: 'json'; text: string } | { kind: 'url'; url: string };
export interface QueryDef { id: string; name: string; source: QuerySource; header: boolean; steps: Step[]; destSheet: string; anchor: string; last?: { r0: number; c0: number; rows: number; cols: number }; auto: boolean; sig?: string }
let defs: QueryDef[] = [];
registerResource('DRACO_QUERIES', { get: () => defs, set: (v) => { defs = Array.isArray(v) ? (v as QueryDef[]) : []; }, reset: () => { defs = []; } });
export const getQueries = () => defs;
export const getQuery = (id: string) => defs.find((d) => d.id === id) ?? null;
const ok = (message: string): Out => ({ ok: true, message }); const fail = (message: string): Out => ({ ok: false, message });
const uid = () => `query-${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
const wbOf = (e: Engine) => e.api.getActiveWorkbook();

/** Load the raw source table (URL sources need `fetched` text because fetching is async). */
export function loadTable(e: Engine, def: Pick<QueryDef, 'source' | 'header'>, fetched?: string): { table?: Table; error?: string; sig?: string } {
  try {
    const s = def.source;
    if (s.kind === 'sheet') { const l = parseRef(e, s.ref); if (!l) return { error: `Range isn't valid: "${s.ref}"` }; const vals = readValues(l) as Cell[][]; return { table: tableFromGrid(vals, def.header), sig: JSON.stringify(vals) }; }
    if (s.kind === 'csv') return { table: tableFromGrid(parseDelimited(s.text), def.header) };
    if (s.kind === 'json') return { table: tableFromJson(s.text) };
    if (fetched === undefined) return { error: 'Fetch the URL first.' };
    const t = fetched.trim(); if (sniffFormat(t) === 'html') { const h = htmlTable(t); if (!h) return { error: 'No table was found on that page.' }; return { table: tableFromGrid(h.map((r) => r.map(typed)), def.header) }; } return { table: t.startsWith('[') || t.startsWith('{') ? tableFromJson(t) : tableFromGrid(parseDelimited(t), def.header) };
  } catch (err) { return { error: (err as Error).message }; }
}
export async function fetchText(url: string): Promise<{ text?: string; error?: string }> {
  try { const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }); if (!r.ok) return { error: `HTTP ${r.status} from ${url}` }; return { text: await r.text() }; }
  catch { return { error: 'The request was blocked or failed (the server may not allow browser access). Download the file and paste it into a CSV/JSON source instead.' }; }
}
const resolver = (e: Engine): Resolver => (src) => {
  if (src.startsWith('query:')) { const q = defs.find((x) => x.name.toLowerCase() === src.slice(6).trim().toLowerCase()); if (!q) return null; const l = loadTable(e, q); return l.table ? runQuery(l.table, q.steps, resolver(e)).table : null; }
  const l = parseRef(e, src); return l ? tableFromGrid(readValues(l) as Cell[][], true) : null;
};
export function previewQuery(e: Engine, def: Pick<QueryDef, 'source' | 'header' | 'steps'>, fetched?: string): { table?: Table; error?: string; failedAt?: number } {
  const l = loadTable(e, def, fetched); if (!l.table) return { error: l.error }; const r = runQuery(l.table, def.steps, resolver(e)); return { table: r.table, error: r.error, failedAt: r.failedAt };
}
export function loadToSheet(e: Engine, def: QueryDef, fetched?: string): Out {
  const wb = wbOf(e); if (!wb) return fail('No workbook open');
  const p = previewQuery(e, def, fetched); if (!p.table) return fail(p.error ?? 'Could not read the source'); if (p.error) return fail(p.error);
  const dest = wb.getSheetByName(def.destSheet); if (!dest) return fail(`Destination sheet "${def.destSheet}" not found`);
  const at = parseRef(e, `${def.destSheet.includes(' ') ? `'${def.destSheet}'` : def.destSheet}!${def.anchor}`); if (!at) return fail(`Destination cell isn't valid: "${def.anchor}"`);
  const t = p.table; if (!t.cols.length) return fail('The query produced no columns.');
  const rect = { r0: at.r0, c0: at.c0, rows: t.rows.length + 1, cols: t.cols.length }; const old = def.last;
  const inOld = (r: number, c: number) => !!old && r >= old.r0 && r < old.r0 + old.rows && c >= old.c0 && c < old.c0 + old.cols;
  const cur = dest.getRange(rect.r0, rect.c0, rect.rows, rect.cols).getValues() as Cell[][];
  for (let r = 0; r < cur.length; r++) for (let c = 0; c < cur[r].length; c++) if (cur[r][c] !== null && cur[r][c] !== '' && cur[r][c] !== undefined && !inOld(rect.r0 + r, rect.c0 + c)) return fail(`The result would overwrite existing data in ${a1(rect.r0 + r, rect.c0 + c)}. Pick an empty destination.`);
  if (def.source.kind === 'sheet') { const s = parseRef(e, def.source.ref); if (s && s.sheet.getSheetName() === def.destSheet && !(rect.r0 + rect.rows <= s.r0 || rect.r0 >= s.r0 + s.rows || rect.c0 + rect.cols <= s.c0 || rect.c0 >= s.c0 + s.cols)) return fail('The result would overlap its own source data. Choose a destination away from the source.'); }
  if (old) { const g = dest.getRange(old.r0, old.c0, old.rows, old.cols); g.clearContent(); g.clearFormat(); }
  const grid: Cell[][] = [t.cols, ...t.rows]; dest.getRange(rect.r0, rect.c0, rect.rows, rect.cols).setValues(grid.map((r) => r.map((v) => (v === undefined ? null : v))) as never);
  const head = dest.getRange(rect.r0, rect.c0, 1, rect.cols); head.setFontWeight('bold'); head.setBackground('#DDEBF7');
  def.last = rect; def.sig = loadTable(e, def, fetched).sig; return ok(`Loaded ${t.rows.length} rows × ${t.cols.length} columns to ${def.destSheet}!${def.anchor}`);
}
export function saveQuery(e: Engine, o: { id?: string; name: string; source: QuerySource; header: boolean; steps: Step[]; dest?: string; auto?: boolean }): Out & { id?: string } {
  const wb = wbOf(e); if (!wb) return fail('No workbook open'); if (!o.name.trim()) return fail('Give the query a name.');
  const dup = defs.find((d) => d.name.toLowerCase() === o.name.trim().toLowerCase() && d.id !== o.id); if (dup) return fail(`A query named "${o.name}" already exists.`);
  let destSheet = wb.getActiveSheet().getSheetName(), anchor = '';
  if (o.dest) { const d = parseRef(e, o.dest); if (!d) return fail(`Destination isn't valid: "${o.dest}"`); destSheet = d.sheet.getSheetName(); anchor = a1(d.r0, d.c0); }
  else { const dr = wb.getActiveSheet().getDataRange().getRange(); anchor = a1(0, dr.endColumn + 2); }
  const existing = o.id ? getQuery(o.id) : null;
  const def: QueryDef = existing ?? { id: uid(), name: o.name.trim(), source: o.source, header: o.header, steps: o.steps, destSheet, anchor, auto: !!o.auto };
  Object.assign(def, { name: o.name.trim(), source: o.source, header: o.header, steps: o.steps, destSheet, anchor: o.dest ? anchor : existing ? existing.anchor : anchor, auto: !!o.auto });
  if (!existing) defs.push(def); return { ...ok('Query saved'), id: def.id };
}
export function removeQuery(e: Engine, id: string, clear = false): Out {
  const d = getQuery(id); if (!d) return fail('Query not found'); if (clear && d.last) { const ws = wbOf(e)?.getSheetByName(d.destSheet); if (ws) { const g = ws.getRange(d.last.r0, d.last.c0, d.last.rows, d.last.cols); g.clearContent(); g.clearFormat(); } }
  defs = defs.filter((x) => x.id !== id); return ok('Query deleted');
}
/** Re-run queries over sheet sources whose cells changed (auto) — URL/CSV/JSON sources only refresh on demand. */
export function refreshQueries(e: Engine, force = false): number {
  let n = 0; for (const d of defs) { if (d.source.kind !== 'sheet') continue; if (!force && !d.auto) continue; const l = loadTable(e, d); if (!l.table) continue; if (force || l.sig !== d.sig) { if (loadToSheet(e, d).ok) n++; } } return n;
}
export async function refreshAllQueries(e: Engine): Promise<Out> {
  let okN = 0; const errs: string[] = [];
  for (const d of defs) { let fetched: string | undefined; if (d.source.kind === 'url') { const f = await fetchText(d.source.url); if (f.error) { errs.push(`${d.name}: ${f.error}`); continue; } fetched = f.text; } const r = loadToSheet(e, d, fetched); if (r.ok) okN++; else errs.push(`${d.name}: ${r.message}`); }
  return errs.length ? fail(`${okN} refreshed. ${errs.join(' | ')}`) : ok(`${okN} quer${okN === 1 ? 'y' : 'ies'} refreshed`);
}

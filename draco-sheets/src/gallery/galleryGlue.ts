// v100 glue: themes, self-test, assistant context.
import type { Engine } from '../engine';
import { THEMES, themeById } from './themes';
import { SELF_CHECKS, compare } from './parity';
import type { Ctx } from './assist';
const KEY = 'draco:theme';
export const getTheme = (): string => { try { return localStorage.getItem(KEY) ?? 'system'; } catch { return 'system'; } };
export function applyTheme(id: string, persist = true) {
  const t = themeById(id); const root = document.documentElement;
  for (const th of THEMES) for (const k of Object.keys(th.vars)) root.style.removeProperty(k);
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
  root.dataset.dracoTheme = t.id; root.style.colorScheme = t.id === 'system' ? '' : t.dark ? 'dark' : 'light';
  if (persist) { try { localStorage.setItem(KEY, t.id); } catch { /* blocked */ } }
}
export const initTheme = () => applyTheme(getTheme(), false);
export interface CheckResult { name: string; formula: string; expect: unknown; got: unknown; pass: boolean }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Evaluate every self-check in a temporary sheet, then remove it. */
export async function runSelfTest(e: Engine): Promise<CheckResult[]> {
  const wb = e.api.getActiveWorkbook(); if (!wb) return []; const prev = wb.getActiveSheet(); const tmp = wb.insertSheet('__selftest__' + Date.now()); const out: CheckResult[] = [];
  try {
    SELF_CHECKS.forEach((c, i) => tmp.getRange(i, 0).setFormula(c.formula)); await wait(700);
    SELF_CHECKS.forEach((c, i) => { const got = tmp.getRange(i, 0).getValue(); out.push({ name: c.name, formula: c.formula, expect: c.expect, got, pass: compare(got, c.expect) }); });
  } finally { try { wb.setActiveSheet(prev); wb.deleteSheet(tmp); } catch { /* ignore */ } }
  return out;
}
export function assistCtx(e: Engine): Ctx {
  const wb = e.api.getActiveWorkbook(); const ws = wb?.getActiveSheet(); if (!ws) return { headers: [], dataRows: 0 };
  const vals = ws.getDataRange().getValues(); const headers = (vals[0] ?? []).map((x) => String(x ?? '')); const rg = wb!.getActiveRange();
  return { headers, dataRows: Math.max(0, vals.length - 1), sel: rg ? { a1: rg.getA1Notation(), r0: rg.getRow(), c0: rg.getColumn(), r1: rg.getLastRow(), c1: rg.getLastColumn() } : undefined };
}
export function selectionValues(e: Engine): unknown[][] { return e.api.getActiveWorkbook()?.getActiveRange()?.getValues() ?? []; }
export function insertFormula(e: Engine, f: string): boolean { const rg = e.api.getActiveWorkbook()?.getActiveRange(); if (!rg) return false; rg.setFormula(f); return true; }
export function activeFormula(e: Engine): string { const rg = e.api.getActiveWorkbook()?.getActiveRange(); return rg?.getFormula?.() ?? ''; }

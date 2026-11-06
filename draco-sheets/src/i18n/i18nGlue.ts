import { mergeLocales } from '@univerjs/presets';
import type { Engine } from '../engine';
import { UI_LOADERS, UI_RTL } from './uiLocales';
import { tr } from './shell';
/** Translate one of Draco's own strings into the current interface language. */
export const t = (s: string): string => tr(ui, s);
const NO_UNIVER_PACK = new Set(['hiIN', 'taIN']);
import { REGIONS, regionById, parseNumber, parseDate, formatNumber, convertFormula, type Region } from './regional';
type Out = { ok: boolean; message: string };
const K_UI = 'draco:ui-lang', K_REGION = 'draco:region'; const get = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }; const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };
let ui = get(K_UI, 'enUS'); let region = regionById(get(K_REGION, 'en-US')); const subs = new Set<() => void>(); export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; }; let ver = 0; export const version = () => ver; const bump = () => { ver++; for (const f of subs) f(); };
export const uiLang = () => ui; export const getRegion = () => region; export const UI_LANGS: Array<[string, string]> = [['enUS', 'English'], ['frFR', 'Français'], ['esES', 'Español'], ['deDE', 'Deutsch'], ['itIT', 'Italiano'], ['ptBR', 'Português (Brasil)'], ['ruRU', 'Русский'], ['jaJP', '日本語'], ['zhCN', '简体中文'], ['koKR', '한국어'], ['arSA', 'العربية'], ['faIR', 'فارسی'], ['hiIN', 'हिन्दी (Draco screens only)'], ['taIN', 'தமிழ் (Draco screens only)']];
export function setRegion(id: string) { region = regionById(id); put(K_REGION, region.id); bump(); }
export async function setUiLanguage(e: Engine, code: string): Promise<Out> {
  try {
    if (NO_UNIVER_PACK.has(code)) { e.api.setLocale('enUS'); ui = code; put(K_UI, code); document.documentElement.lang = code.slice(0, 2); document.documentElement.dir = 'ltr'; bump(); return { ok: true, message: 'Draco’s screens changed. The spreadsheet’s own menus stay in English for this language.' }; }
    if (code !== 'enUS') { const loader = UI_LOADERS[code]; if (!loader) return { ok: false, message: 'That language isn’t available' }; const packs = await loader(); e.api.loadLocales(code, mergeLocales(...(packs as never[])) as never); }
    e.api.setLocale(code); ui = code; put(K_UI, code); document.documentElement.lang = code.slice(0, 2); document.documentElement.dir = UI_RTL.has(code) ? 'rtl' : 'ltr'; bump(); return { ok: true, message: 'Language changed' };
  } catch (err) { return { ok: false, message: `Could not load that language: ${(err as Error).message}` }; }
}
export async function restoreUi(e: Engine) { if (ui !== 'enUS') await setUiLanguage(e, ui); }
export function setSheetRtl(e: Engine, rtl: boolean): Out {
  const wb = e.api.getActiveWorkbook(); const ws = wb?.getActiveSheet(); if (!wb || !ws) return { ok: false, message: 'No sheet' };
  try { (ws.getSheet().getConfig() as { rightToLeft?: number }).rightToLeft = rtl ? 1 : 0; return { ok: true, message: rtl ? 'Sheet marked right to left. It is saved in the file; this version still draws the grid left to right.' : 'Sheet marked left to right' }; } catch (err) { return { ok: false, message: (err as Error).message }; }
}
export const isSheetRtl = (e: Engine) => { const wb = e.api.getActiveWorkbook(); const id = wb?.getActiveSheet().getSheetId(); const s = wb?.save() as unknown as { sheets?: Record<string, { rightToLeft?: number }> } | undefined; return !!(id && s?.sheets?.[id]?.rightToLeft); };
/** Turn text cells in the selection that are numbers/dates in the chosen region's style into real numbers/dates. */
export function convertSelection(e: Engine, r: Region, what: 'numbers' | 'dates' | 'both', dry = false): Out & { numbers: number; dates: number } {
  const rg = e.api.getActiveWorkbook()?.getActiveRange(); if (!rg) return { ok: false, message: 'Select the cells to convert first', numbers: 0, dates: 0 };
  const vals = rg.getValues(); let nn = 0, nd = 0; const out = vals.map((row) => row.map((v) => { if (typeof v !== 'string') return v; if (what !== 'dates') { const x = parseNumber(v, r); if (x !== null) { nn++; return x; } } if (what !== 'numbers') { const d = parseDate(v, r); if (d !== null) { nd++; return d; } } return v; }));
  if (!dry && (nn || nd)) { rg.setValues(out as never); if (nd) { const fmt = r.pattern; const r0 = rg.getRow(), c0 = rg.getColumn(); const ws = e.api.getActiveWorkbook()!.getActiveSheet(); out.forEach((row, i) => row.forEach((v, j) => { if (typeof v === 'number' && typeof vals[i][j] === 'string' && parseDate(String(vals[i][j]), r) === v && parseNumber(String(vals[i][j]), r) === null) ws.getRange(r0 + i, c0 + j).setNumberFormat(fmt); })); } }
  return { ok: nn + nd > 0, message: nn + nd ? `${dry ? 'Would convert' : 'Converted'} ${nn} number${nn === 1 ? '' : 's'} and ${nd} date${nd === 1 ? '' : 's'}` : 'Nothing in the selection looked like a number or date in that style', numbers: nn, dates: nd };
}
export function applyRegionFormat(e: Engine, r: Region, kind: 'currency' | 'date' | 'number'): Out {
  const rg = e.api.getActiveWorkbook()?.getActiveRange(); if (!rg) return { ok: false, message: 'Select cells first' };
  const sym = r.currency.symbol.replace(/"/g, ''); const fmt = kind === 'date' ? r.pattern : kind === 'currency' ? (r.currency.after ? `#,##0.00" ${sym}"` : `"${sym}"#,##0.00`) : '#,##0.00'; rg.setNumberFormat(fmt); return { ok: true, message: `Applied ${fmt}` };
}
export function install(w: Record<string, unknown>, e: () => Engine) { w.dracoI18n = { regions: REGIONS.map((r) => r.id), setRegion, region: () => region.id, setUi: (c: string) => setUiLanguage(e(), c), ui: uiLang, rtl: (v: boolean) => setSheetRtl(e(), v), isRtl: () => isSheetRtl(e()), convert: (id: string, what: 'numbers' | 'dates' | 'both', dry?: boolean) => convertSelection(e(), regionById(id), what, dry), applyFormat: (id: string, k: 'currency' | 'date' | 'number') => applyRegionFormat(e(), regionById(id), k), fmt: (n: number, id: string) => formatNumber(n, regionById(id)), formula: (f: string, a: string, b: string) => convertFormula(f, regionById(a), regionById(b)) }; }

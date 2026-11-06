// v96 glue: apply settings, live announcements of the active cell, tab-list arrow keys, skip link.
import type { Engine } from '../engine';
import { parseA11y, describeCell, checkAccessibility, type A11y, type Issue } from './a11y';
import { listLinks } from '../links/linksGlue';
const KEY = 'draco:a11y'; let cur: A11y = parseA11y((() => { try { return localStorage.getItem(KEY); } catch { return null; } })());
const subs = new Set<() => void>(); export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; }; let ver = 0; export const version = () => ver;
export const get = () => cur;
export function apply(s: A11y = cur) {
  const d = document.documentElement; d.classList.toggle('hc', s.highContrast); d.classList.toggle('reduce-motion', s.reduceMotion); d.classList.toggle('strong-focus', s.strongFocus); d.style.setProperty('--ui-scale', String(s.textScale / 100)); d.style.fontSize = s.textScale === 100 ? '' : `${s.textScale}%`;
}
export function set(p: Partial<A11y>) { cur = { ...cur, ...p }; try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage blocked */ } apply(); restartAnnouncer(); ver++; for (const f of subs) f(); }
let eng: Engine | null = null; let timer = 0; let lastKey = ''; let live: HTMLElement | null = null;
function ensureLive() { if (live && document.body.contains(live)) return live; live = document.createElement('div'); live.id = 'draco-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true'); live.className = 'sr-only'; document.body.appendChild(live); return live; }
export const announce = (text: string) => { const l = ensureLive(); l.textContent = ''; window.setTimeout(() => { l.textContent = text; }, 30); };
function describeActive(): { key: string; text: string } | null {
  const wb = eng?.api.getActiveWorkbook(); const rg = wb?.getActiveRange(); if (!wb || !rg) return null; const ws = wb.getActiveSheet(); const r = rg.getRow(), c = rg.getColumn(); const key = `${ws.getSheetId()}:${r}:${c}:${rg.getLastRow()}:${rg.getLastColumn()}`;
  const cell = ws.getRange(r, c); const v = cell.getValue(); const f = cell.getFormula(); const disp = (cell.getDisplayValues() as string[][])[0]?.[0];
  const hv = (rr: number, cc: number) => { const x = ws.getRange(rr, cc).getValue(); return x === null || x === '' || x === undefined ? undefined : String(x); };
  const m = ((ws as unknown as { getMergedRanges?: () => Array<{ getA1Notation(): string; getRow(): number; getColumn(): number; getLastRow(): number; getLastColumn(): number }> }).getMergedRanges?.() ?? []).find((x) => r >= x.getRow() && r <= x.getLastRow() && c >= x.getColumn() && c <= x.getLastColumn()); const merged = m?.getA1Notation();
  let text = describeCell({ sheet: ws.getSheetName(), a1: cell.getA1Notation(), value: v, display: disp, formula: f || undefined, colHeader: r > 0 ? hv(0, c) : undefined, rowHeader: c > 0 ? hv(r, 0) : undefined, merged });
  const multi = rg.getLastRow() !== r || rg.getLastColumn() !== c; if (multi) text = `${rg.getA1Notation()} selected. ` + text; return { key, text };
}
function tick() { const d = describeActive(); if (d && d.key !== lastKey) { lastKey = d.key; if (document.activeElement && (document.activeElement as HTMLElement).closest?.('.dialog')) return; announce(d.text); } }
function restartAnnouncer() { window.clearInterval(timer); if (cur.announce && eng) { lastKey = ''; timer = window.setInterval(tick, 350); } }
export function runChecker(e: Engine): Issue[] { const snap = e.api.getActiveWorkbook()?.save() as never; if (!snap) return []; return checkAccessibility(snap, { links: listLinks(e).map((l) => ({ sheetId: l.sheetId, row: l.row, col: l.col, text: l.text, url: l.url })) }); }
/** One document-level handler gives every role=tablist Left/Right/Home/End navigation. */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null; const list = t?.closest?.('[role=tablist]'); if (!list || t?.getAttribute('role') !== 'tab') return; const tabs = [...list.querySelectorAll<HTMLElement>('[role=tab]')]; const i = tabs.indexOf(t); let j = -1;
  if (e.key === 'ArrowRight') j = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = tabs.length - 1; if (j < 0) return; e.preventDefault(); tabs[j].focus(); tabs[j].click(); window.setTimeout(() => (list.querySelector<HTMLElement>('[role=tab][aria-selected=true]') ?? tabs[j]).focus(), 0);
}
export function skipToGrid() { const g = document.querySelector<HTMLElement>('main.grid canvas, main.grid [tabindex], main.grid'); (g as HTMLElement | null)?.focus?.(); document.querySelector<HTMLElement>('main.grid canvas')?.click(); }
export function init(e: Engine) { eng = e; apply(); document.addEventListener('keydown', onKey); restartAnnouncer(); (window as unknown as Record<string, unknown>).dracoA11y = { get, set, announce, check: () => runChecker(e) }; }
export function dispose() { window.clearInterval(timer); document.removeEventListener('keydown', onKey); eng = null; }
apply();

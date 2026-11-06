// Protection helpers (v92): lock geometry, permission-point mapping, password hashing.
export interface Rect { r0: number; c0: number; r1: number; c1: number }
export interface Allow { selectLocked: boolean; selectUnlocked: boolean; formatCells: boolean; insertRows: boolean; insertColumns: boolean; deleteRows: boolean; deleteColumns: boolean; sort: boolean; filter: boolean; objects: boolean }
export const defaultAllow = (): Allow => ({ selectLocked: true, selectUnlocked: true, formatCells: false, insertRows: false, insertColumns: false, deleteRows: false, deleteColumns: false, sort: false, filter: false, objects: false });
export interface SheetProtection { enabled: boolean; salt?: string; hash?: string; allow: Allow; unlocked: string[]; locked: string[] }
export const emptyProtection = (): SheetProtection => ({ enabled: false, allow: defaultAllow(), unlocked: [], locked: [] });
/** Univer worksheet permission points an option controls (true value = allowed). */
export function pointsFor(a: Allow): Record<string, boolean> {
  return { WorksheetSelectProtectedCells: a.selectLocked, WorksheetSelectUnProtectedCells: a.selectUnlocked, WorksheetSetCellStyle: a.formatCells, WorksheetSetRowStyle: a.formatCells, WorksheetSetColumnStyle: a.formatCells, WorksheetInsertRow: a.insertRows, WorksheetInsertColumn: a.insertColumns, WorksheetDeleteRow: a.deleteRows, WorksheetDeleteColumn: a.deleteColumns, WorksheetSort: a.sort, WorksheetFilter: a.filter, WorksheetEditExtraObject: a.objects };
}
export const normRect = (r: Rect): Rect => ({ r0: Math.min(r.r0, r.r1), c0: Math.min(r.c0, r.c1), r1: Math.max(r.r0, r.r1), c1: Math.max(r.c0, r.c1) });
const colName = (c: number) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const rectToA1 = (r: Rect) => (r.r0 === r.r1 && r.c0 === r.c1 ? `${colName(r.c0)}${r.r0 + 1}` : `${colName(r.c0)}${r.r0 + 1}:${colName(r.c1)}${r.r1 + 1}`);
export function parseRect(s: string): Rect | null { const m = /^\s*\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?\s*$/.exec(s); if (!m) return null; const ci = (x: string) => { let n = 0; for (const ch of x.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }; const r = { r0: +m[2] - 1, c0: ci(m[1]), r1: +(m[4] ?? m[2]) - 1, c1: ci(m[3] ?? m[1]) }; return r.r0 < 0 || r.r1 < 0 ? null : normRect(r); }
export const rectsOverlap = (a: Rect, b: Rect) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
/** Disjoint rectangles covering the rows×cols grid except the unlocked ones (so locking the complement == protecting the sheet except those cells). */
export function complementRects(rows: number, cols: number, unlocked: Rect[]): Rect[] {
  const us = unlocked.map(normRect).map((r) => ({ r0: Math.max(0, r.r0), c0: Math.max(0, r.c0), r1: Math.min(rows - 1, r.r1), c1: Math.min(cols - 1, r.c1) })).filter((r) => r.r0 <= r.r1 && r.c0 <= r.c1);
  if (!us.length) return [{ r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 }];
  const rowCuts = [...new Set([0, rows, ...us.flatMap((r) => [r.r0, r.r1 + 1])])].filter((x) => x >= 0 && x <= rows).sort((a, b) => a - b); const out: Rect[] = [];
  for (let i = 0; i < rowCuts.length - 1; i++) {
    const r0 = rowCuts[i], r1 = rowCuts[i + 1] - 1; const band = us.filter((u) => u.r0 <= r0 && u.r1 >= r1).sort((a, b) => a.c0 - b.c0); let c = 0;
    for (const u of band) { if (u.c0 > c) out.push({ r0, r1, c0: c, c1: u.c0 - 1 }); c = Math.max(c, u.c1 + 1); } if (c < cols) out.push({ r0, r1, c0: c, c1: cols - 1 });
  }
  // merge vertically adjacent identical column spans
  const merged: Rect[] = []; for (const r of out) { const prev = merged.find((m) => m.c0 === r.c0 && m.c1 === r.c1 && m.r1 + 1 === r.r0); if (prev) prev.r1 = r.r1; else merged.push({ ...r }); } return merged;
}
export const isLocked = (rects: Rect[], r: number, c: number) => rects.some((x) => r >= x.r0 && r <= x.r1 && c >= x.c0 && c <= x.c1);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(12)).buffer);
export async function hashPassword(pw: string, salt: string): Promise<string> { const data = new TextEncoder().encode(`${salt}:${pw}`); let h = await crypto.subtle.digest('SHA-256', data); for (let i = 0; i < 2000; i++) h = await crypto.subtle.digest('SHA-256', new Uint8Array([...new Uint8Array(h), ...data.slice(0, 16)])); return hex(h); }
export async function verifyPassword(p: SheetProtection, pw: string): Promise<boolean> { if (!p.hash || !p.salt) return true; return (await hashPassword(pw, p.salt)) === p.hash; }

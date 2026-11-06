// Track changes (v91): a log of cell edits with before/after values and the ability to revert.
export interface Change { id: string; at: string; user: string; sheetId: string; sheet: string; r: number; c: number; before: string; after: string; kind: 'edit' | 'clear' | 'add'; source?: 'local' | 'remote' }
let n = 0; const uid = () => `chg-${Date.now().toString(36)}${(n++).toString(36)}`;
export const MAX_LOG = 3000;
export interface CellLike { v?: string | number | boolean | null; f?: string | null }
/** Text form of a cell for the log: formulas show as "=..." and values as written. */
export const cellText = (c: CellLike | null | undefined): string => { if (!c) return ''; if (c.f) return String(c.f).startsWith('=') ? String(c.f) : '=' + c.f; if (c.v === null || c.v === undefined) return ''; return String(c.v); };
export function makeChange(o: { user: string; sheetId: string; sheet: string; r: number; c: number; before: string; after: string; now?: Date; source?: 'local' | 'remote' }): Change | null {
  if (o.before === o.after) return null; return { id: uid(), at: (o.now ?? new Date()).toISOString(), user: o.user, sheetId: o.sheetId, sheet: o.sheet, r: o.r, c: o.c, before: o.before, after: o.after, kind: o.before === '' ? 'add' : o.after === '' ? 'clear' : 'edit', source: o.source };
}
/** Append keeping the newest MAX_LOG entries; consecutive edits of one cell by one user within `mergeMs` collapse into one (before of first, after of last). */
export function appendChange(log: Change[], ch: Change, mergeMs = 4000): Change[] {
  const last = log[log.length - 1];
  if (last && last.sheetId === ch.sheetId && last.r === ch.r && last.c === ch.c && last.user === ch.user && new Date(ch.at).getTime() - new Date(last.at).getTime() < mergeMs) {
    const merged = makeChange({ user: ch.user, sheetId: ch.sheetId, sheet: ch.sheet, r: ch.r, c: ch.c, before: last.before, after: ch.after, now: new Date(ch.at), source: ch.source }); const base = log.slice(0, -1); if (!merged) return base; merged.id = last.id; return base.concat(merged);
  }
  const out = log.concat(ch); return out.length > MAX_LOG ? out.slice(out.length - MAX_LOG) : out;
}
export interface LogFilter { user?: string; sheetId?: string; since?: string; q?: string; kind?: Change['kind'] }
export const filterLog = (log: Change[], f: LogFilter = {}): Change[] => { const q = f.q?.toLowerCase(); return log.filter((c) => (!f.user || c.user === f.user) && (!f.sheetId || c.sheetId === f.sheetId) && (!f.since || c.at >= f.since) && (!f.kind || c.kind === f.kind) && (!q || c.before.toLowerCase().includes(q) || c.after.toLowerCase().includes(q))); };
export const users = (log: Change[]): string[] => [...new Set(log.map((c) => c.user))].sort();
/** Plan reverting changes (newest first). A change can only be reverted while the cell still holds its "after" value. */
export function planRevert(changes: Change[], current: (c: Change) => string): Array<{ change: Change; ok: boolean; reason?: string }> {
  const seen = new Set<string>(); const plan: Array<{ change: Change; ok: boolean; reason?: string }> = [];
  for (const ch of [...changes].sort((a, b) => b.at.localeCompare(a.at))) { const key = `${ch.sheetId}!${ch.r},${ch.c}`; const now = current(ch); if (seen.has(key)) { plan.push({ change: ch, ok: false, reason: 'A newer change to this cell is also being reverted' }); continue; } seen.add(key); plan.push(now === ch.after ? { change: ch, ok: true } : { change: ch, ok: false, reason: `The cell has changed since (now "${now}")` }); }
  return plan;
}
const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export function logToCsv(log: Change[], addr: (r: number, c: number) => string): string { return [['When', 'Who', 'Sheet', 'Cell', 'Change', 'Before', 'After'], ...log.map((c) => [c.at, c.user, c.sheet, addr(c.r, c.c), c.kind, c.before, c.after])].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n'; }
/** Cells touched since a time, per sheet (for highlighting). */
export function touchedSince(log: Change[], since: string): Map<string, Array<{ r: number; c: number; user: string }>> { const out = new Map<string, Array<{ r: number; c: number; user: string }>>(); for (const c of log) { if (c.at < since) continue; const a = out.get(c.sheetId) ?? []; if (!a.some((x) => x.r === c.r && x.c === c.c)) a.push({ r: c.r, c: c.c, user: c.user }); out.set(c.sheetId, a); } return out; }

// Version history helpers (v85) and offline sync queue (v86): pure logic, no storage.
import { a1, cellValue, orderedSheets, styleOf, type Cell, type SheetSnap, type Snap } from './model';

/** Stable FNV-1a hash of the parts of a snapshot that matter to users (sheets, cells, styles, sizes). */
export function snapHash(snap: Snap): string {
  let h = 2166136261 >>> 0; const feed = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const sh of orderedSheets(snap)) {
    feed(`#${sh.name}|${sh.hidden ?? 0}|${sh.tabColor ?? ''}`); const rows = Object.keys(sh.cellData ?? {}).map(Number).sort((a, b) => a - b);
    for (const r of rows) { const row = sh.cellData![r]; for (const c of Object.keys(row).map(Number).sort((a, b) => a - b)) { const cell = row[c]; feed(`${r},${c}:${cellValue(cell)}|${cell.f ?? ''}|${JSON.stringify(styleOf(snap, cell))}`); } }
    feed(JSON.stringify(sh.mergeData ?? [])); feed(JSON.stringify(sh.columnData ?? {})); feed(JSON.stringify(sh.rowData ?? {})); feed(JSON.stringify(sh.freeze ?? null));
  }
  return h.toString(36);
}
export interface CellChange { sheet: string; addr: string; kind: 'added' | 'removed' | 'changed' | 'format'; before: string; after: string }
export interface Diff { sheetsAdded: string[]; sheetsRemoved: string[]; sheetsRenamed: Array<{ from: string; to: string }>; changes: CellChange[]; total: number; truncated: boolean }
const show = (cell: Cell | undefined): string => { if (!cell) return ''; const v = cellValue(cell); return cell.f ? `${cell.f}${v !== null ? ` → ${String(v)}` : ''}` : v === null ? '' : String(v); };
const sameStyle = (snapA: Snap, a: Cell | undefined, snapB: Snap, b: Cell | undefined) => JSON.stringify(styleOf(snapA, a)) === JSON.stringify(styleOf(snapB, b));
/** Compare two snapshots cell by cell (sheets matched by id, then by name). */
export function diffSnapshots(before: Snap, after: Snap, limit = 500): Diff {
  const A = orderedSheets(before), B = orderedSheets(after); const used = new Set<string>(); const pairs: Array<[SheetSnap | undefined, SheetSnap | undefined]> = [];
  const byName = new Map(A.map((s) => [s.name, s])); const byId = new Map(A.map((s) => [s.id, s]));
  for (const b of B) { const a = byId.get(b.id) ?? byName.get(b.name); if (a && !used.has(a.id)) { used.add(a.id); pairs.push([a, b]); } else pairs.push([undefined, b]); }
  for (const a of A) if (!used.has(a.id)) pairs.push([a, undefined]);
  const d: Diff = { sheetsAdded: [], sheetsRemoved: [], sheetsRenamed: [], changes: [], total: 0, truncated: false };
  const push = (c: CellChange) => { d.total++; if (d.changes.length < limit) d.changes.push(c); else d.truncated = true; };
  for (const [a, b] of pairs) {
    if (!a && b) { d.sheetsAdded.push(b.name); continue; } if (a && !b) { d.sheetsRemoved.push(a.name); continue; } if (!a || !b) continue; if (a.name !== b.name) d.sheetsRenamed.push({ from: a.name, to: b.name });
    const rows = new Set([...Object.keys(a.cellData ?? {}), ...Object.keys(b.cellData ?? {})].map(Number)); for (const r of [...rows].sort((x, y) => x - y)) {
      const cols = new Set([...Object.keys(a.cellData?.[r] ?? {}), ...Object.keys(b.cellData?.[r] ?? {})].map(Number)); for (const c of [...cols].sort((x, y) => x - y)) {
        const ca = a.cellData?.[r]?.[c], cb = b.cellData?.[r]?.[c]; const sa = show(ca), sb = show(cb); const where = { sheet: b.name, addr: a1(r, c) };
        if (sa !== sb) push({ ...where, kind: sa === '' ? 'added' : sb === '' ? 'removed' : 'changed', before: sa, after: sb });
        else if (!sameStyle(before, ca, after, cb) && (sa !== '' || sb !== '')) push({ ...where, kind: 'format', before: sa, after: sb });
      } }
  }
  return d;
}
export const describeDiff = (d: Diff): string => { if (!d.total && !d.sheetsAdded.length && !d.sheetsRemoved.length && !d.sheetsRenamed.length) return 'No differences.'; const n = (k: CellChange['kind']) => d.changes.filter((c) => c.kind === k).length; const bits = [n('changed') && `${n('changed')} changed`, n('added') && `${n('added')} added`, n('removed') && `${n('removed')} removed`, n('format') && `${n('format')} formatted`, d.sheetsAdded.length && `${d.sheetsAdded.length} sheet(s) added`, d.sheetsRemoved.length && `${d.sheetsRemoved.length} sheet(s) removed`, d.sheetsRenamed.length && `${d.sheetsRenamed.length} renamed`].filter(Boolean); return bits.join(', ') + (d.truncated ? ` (showing first ${d.changes.length} of ${d.total})` : ''); };

/** Which stored versions to drop: keep every manual one and the newest `keepAuto` automatic ones. */
export function pruneList<T extends { key: number | string; kind: 'auto' | 'manual'; at: string }>(all: T[], keepAuto = 30): T[] {
  const auto = all.filter((v) => v.kind === 'auto').sort((a, b) => b.at.localeCompare(a.at)); return auto.slice(keepAuto);
}
export function shouldCheckpoint(lastAutoAt: string | undefined, lastHash: string | undefined, hash: string, now = Date.now(), minGapMs = 5 * 60_000): boolean {
  if (hash === lastHash) return false; if (!lastAutoAt) return true; return now - new Date(lastAutoAt).getTime() >= minGapMs;
}

/* ---------- offline sync queue ---------- */
export interface QueueItem { id: string; since: string; tries: number; lastError?: string }
export class SyncQueue {
  private items: QueueItem[];
  constructor(private store: { get(): string | null; set(v: string): void }) { let parsed: unknown = []; try { parsed = JSON.parse(store.get() ?? '[]'); } catch { /* corrupt: start empty */ } this.items = Array.isArray(parsed) ? (parsed as QueueItem[]).filter((x) => x && typeof x.id === 'string') : []; }
  private save() { this.store.set(JSON.stringify(this.items)); }
  list() { return [...this.items]; } size() { return this.items.length; }
  add(id: string) { const ex = this.items.find((x) => x.id === id); if (!ex) this.items.push({ id, since: new Date().toISOString(), tries: 0 }); this.save(); }
  remove(id: string) { this.items = this.items.filter((x) => x.id !== id); this.save(); }
  /** Try each queued workbook; failures stay queued (max 8 tries each, then the error is kept and retried only on next explicit run). */
  async process(push: (id: string) => Promise<void>): Promise<{ done: string[]; failed: Array<{ id: string; error: string }> }> {
    const done: string[] = [], failed: Array<{ id: string; error: string }> = [];
    for (const it of [...this.items]) { try { await push(it.id); this.remove(it.id); done.push(it.id); } catch (e) { it.tries++; it.lastError = (e as Error).message; failed.push({ id: it.id, error: it.lastError }); this.save(); } }
    return { done, failed };
  }
}

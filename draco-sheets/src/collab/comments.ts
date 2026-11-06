// Comments with threaded replies (v87): pure data operations, merge for live sessions, anchor shifting.
export interface Reply { id: string; author: string; at: string; text: string; edited?: boolean }
export interface Thread { id: string; sheetId: string; r: number; c: number; author: string; at: string; text: string; replies: Reply[]; resolved: boolean; resolvedBy?: string; updatedAt: string; edited?: boolean }
export interface CommentStore { threads: Thread[]; tomb: Record<string, string> }
export const emptyStore = (): CommentStore => ({ threads: [], tomb: {} });
let n = 0; export const uid = (p = 'c') => `${p}-${Date.now().toString(36)}${(n++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const iso = (now?: Date) => (now ?? new Date()).toISOString();
const clean = (s: string) => s.replace(/\r\n?/g, '\n').trim();

export function addThread(st: CommentStore, o: { sheetId: string; r: number; c: number; author: string; text: string; now?: Date }): Thread | null {
  const text = clean(o.text); if (!text || o.r < 0 || o.c < 0) return null; const at = iso(o.now);
  const t: Thread = { id: uid('thr'), sheetId: o.sheetId, r: o.r, c: o.c, author: o.author, at, text, replies: [], resolved: false, updatedAt: at }; st.threads.push(t); return t;
}
const find = (st: CommentStore, id: string) => st.threads.find((t) => t.id === id);
export function addReply(st: CommentStore, id: string, author: string, text: string, now?: Date): Reply | null {
  const t = find(st, id); const body = clean(text); if (!t || !body) return null; const at = iso(now); const r: Reply = { id: uid('rep'), author, at, text: body }; t.replies.push(r); t.updatedAt = at; return r;
}
export function setResolved(st: CommentStore, id: string, by: string, resolved: boolean, now?: Date): boolean { const t = find(st, id); if (!t) return false; t.resolved = resolved; t.resolvedBy = resolved ? by : undefined; t.updatedAt = iso(now); return true; }
export function editText(st: CommentStore, id: string, text: string, replyId?: string, now?: Date): boolean {
  const t = find(st, id); const body = clean(text); if (!t || !body) return false; if (replyId) { const r = t.replies.find((x) => x.id === replyId); if (!r) return false; r.text = body; r.edited = true; } else { t.text = body; t.edited = true; } t.updatedAt = iso(now); return true;
}
export function deleteThread(st: CommentStore, id: string, now?: Date): boolean { const i = st.threads.findIndex((t) => t.id === id); if (i < 0) return false; st.threads.splice(i, 1); st.tomb[id] = iso(now); return true; }
export function deleteReply(st: CommentStore, id: string, replyId: string, now?: Date): boolean { const t = find(st, id); if (!t) return false; const i = t.replies.findIndex((r) => r.id === replyId); if (i < 0) return false; t.replies.splice(i, 1); t.updatedAt = iso(now); return true; }
export const threadsAt = (st: CommentStore, sheetId: string, r: number, c: number) => st.threads.filter((t) => t.sheetId === sheetId && t.r === r && t.c === c);
export interface Filter { sheetId?: string; status?: 'open' | 'resolved' | 'all'; author?: string; q?: string }
export function filterThreads(st: CommentStore, f: Filter = {}): Thread[] {
  const q = f.q?.trim().toLowerCase(); return st.threads.filter((t) => (!f.sheetId || t.sheetId === f.sheetId) && (f.status === 'resolved' ? t.resolved : f.status === 'all' || !f.status ? true : !t.resolved) && (!f.author || t.author === f.author || t.replies.some((r) => r.author === f.author)) && (!q || t.text.toLowerCase().includes(q) || t.replies.some((r) => r.text.toLowerCase().includes(q))))
    .sort((a, b) => a.sheetId.localeCompare(b.sheetId) || a.r - b.r || a.c - b.c || a.at.localeCompare(b.at));
}
export const summary = (st: CommentStore) => ({ open: st.threads.filter((t) => !t.resolved).length, resolved: st.threads.filter((t) => t.resolved).length, total: st.threads.length, replies: st.threads.reduce((a, t) => a + t.replies.length, 0) });
/** Keep thread anchors on their cells when rows/columns are inserted (index = first new line) or removed (threads inside are dropped). */
export function shiftAnchors(st: CommentStore, sheetId: string, axis: 'row' | 'col', index: number, count: number, kind: 'insert' | 'remove', now?: Date): { moved: number; dropped: Thread[] } {
  let moved = 0; const dropped: Thread[] = [];
  for (const t of [...st.threads]) {
    if (t.sheetId !== sheetId) continue; const pos = axis === 'row' ? t.r : t.c; let next = pos;
    if (kind === 'insert') { if (pos >= index) next = pos + count; } else { if (pos >= index && pos < index + count) { st.threads.splice(st.threads.indexOf(t), 1); st.tomb[t.id] = iso(now); dropped.push(t); continue; } if (pos >= index + count) next = pos - count; }
    if (next !== pos) { if (axis === 'row') t.r = next; else t.c = next; moved++; t.updatedAt = iso(now); }
  }
  return { moved, dropped };
}
/** Union of two stores (replicas of the same workbook): newest edit of a thread wins, replies are unioned, deletions win over older edits. */
export function mergeStores(a: CommentStore, b: CommentStore): CommentStore {
  const tomb: Record<string, string> = { ...a.tomb }; for (const [k, v] of Object.entries(b.tomb)) if (!tomb[k] || tomb[k] < v) tomb[k] = v;
  const map = new Map<string, Thread>();
  for (const t of [...a.threads, ...b.threads]) {
    const ex = map.get(t.id); if (!ex) { map.set(t.id, JSON.parse(JSON.stringify(t)) as Thread); continue; }
    const [newer, older] = ex.updatedAt >= t.updatedAt ? [ex, t] : [t, ex]; const merged = JSON.parse(JSON.stringify(newer)) as Thread; const seen = new Set(merged.replies.map((r) => r.id)); for (const r of older.replies) if (!seen.has(r.id)) merged.replies.push(JSON.parse(JSON.stringify(r)) as Reply);
    merged.replies.sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id)); map.set(t.id, merged);
  }
  const threads = [...map.values()].filter((t) => !tomb[t.id] || tomb[t.id] < t.updatedAt).sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id));
  return { threads, tomb };
}
const csv = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export function threadsToCsv(list: Thread[], sheetName: (id: string) => string, addr: (r: number, c: number) => string): string {
  const rows = [['Sheet', 'Cell', 'Status', 'Author', 'Date', 'Comment', 'Replies']]; for (const t of list) rows.push([sheetName(t.sheetId), addr(t.r, t.c), t.resolved ? 'Resolved' : 'Open', t.author, t.at, t.text, t.replies.map((r) => `${r.author}: ${r.text}`).join(' | ')]);
  return rows.map((r) => r.map(csv).join(',')).join('\r\n') + '\r\n';
}
export const initials = (name: string) => (name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?');
const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080', '#9a6324', '#800000', '#808000', '#000075'];
export function colorFor(key: string): string { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }

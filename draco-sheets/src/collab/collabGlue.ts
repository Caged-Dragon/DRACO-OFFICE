// Engine glue for v87–v92: comments + markers, notes, live co-editing, change log, protection, share links.
import type { Engine } from '../engine';
import { registerResource } from '../persist';
import { cellOrigin, replaceFloat, type WS } from '../charts/chartGlue';
import * as C from './comments';
import * as L from './changelog';
import * as P from './protect';
import * as S from './share';
import { Session, broadcastTransport, supabaseTransport, shouldBroadcast, HEARTBEAT_MS, type Peer, type Sel } from './sync';
import { supabase } from '../supabase';

export const MARK_KEY = 'draco-cmark'; export const PEER_KEY = 'draco-peer';
type Out = { ok: boolean; message: string };
const ok = (message: string): Out => ({ ok: true, message }); const fail = (message: string): Out => ({ ok: false, message });
const colName = (c: number) => { let s = '', n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const a1 = (r: number, c: number) => `${colName(c)}${r + 1}`;

// ---- identity
export interface Me { id: string; name: string; color: string }
function loadMe(): Me {
  try { const j = JSON.parse(localStorage.getItem('draco:me') ?? 'null') as Me | null; if (j?.id && j.name) return j; } catch { /* ignore */ }
  const id = 'u' + Math.random().toString(36).slice(2, 9); const m = { id, name: 'Guest ' + id.slice(-3).toUpperCase(), color: C.colorFor(id) }; try { localStorage.setItem('draco:me', JSON.stringify(m)); } catch { /* ignore */ } return m;
}
export const me: Me = loadMe();
export function setMyName(name: string) { const n = name.trim().slice(0, 40); if (!n) return; me.name = n; try { localStorage.setItem('draco:me', JSON.stringify(me)); } catch { /* ignore */ } notify(); }

// ---- shared state
let eng: Engine | null = null; let comments = C.emptyStore(); let log: L.Change[] = []; let prot: Record<string, P.SheetProtection> = {}; let wbProt: { enabled: boolean; salt?: string; hash?: string } = { enabled: false };
let session: Session | null = null; let room = ''; let myRole: S.Role = 'edit'; let peers: Peer[] = []; let hostMode = false; let saveHook: () => void = () => undefined; let applyingRemote: Peer | null = null; let remoteApplying = false;
const listeners = new Set<() => void>(); export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
let ver = 0; export const version = () => ver; function notify() { ver++; for (const l of listeners) l(); }
export const setSaveHook = (fn: () => void) => { saveHook = fn; };
const wbOf = () => eng?.api.getActiveWorkbook() ?? null;
const sheetName = (id: string) => { const wb = wbOf(); return wb?.getSheetBySheetId(id)?.getSheetName() ?? id; };

registerResource('DRACO_COMMENTS', { get: () => (comments.threads.length || Object.keys(comments.tomb).length ? comments : undefined), set: (v) => { const o = v as Partial<C.CommentStore>; comments = { threads: o.threads ?? [], tomb: o.tomb ?? {} }; schedule(() => syncMarkers()); }, reset: () => { comments = C.emptyStore(); } });
registerResource('DRACO_CHANGELOG', { get: () => (log.length ? log : undefined), set: (v) => { log = Array.isArray(v) ? (v as L.Change[]) : []; }, reset: () => { log = []; } });
registerResource('DRACO_PROTECT', { get: () => (Object.keys(prot).length || wbProt.enabled ? { sheets: prot, wb: wbProt } : undefined), set: (v) => { const o = v as { sheets?: Record<string, P.SheetProtection>; wb?: typeof wbProt }; prot = o.sheets ?? {}; wbProt = o.wb ?? { enabled: false }; schedule(() => void applyAllProtection(), 500); }, reset: () => { prot = {}; wbProt = { enabled: false }; } });
const timers = new Map<string, number>(); function schedule(fn: () => void, ms = 120) { const k = fn.toString(); window.clearTimeout(timers.get(k)); timers.set(k, window.setTimeout(fn, ms)); }

// ====================== comments (v87) ======================
const sheetIdOf = () => wbOf()?.getActiveSheet().getSheetId() ?? '';
export function selectionCell(): { sheetId: string; r: number; c: number } | null { const wb = wbOf(); const rg = wb?.getActiveRange(); if (!wb || !rg) return null; return { sheetId: wb.getActiveSheet().getSheetId(), r: rg.getRow(), c: rg.getColumn() }; }
export const getComments = () => comments;
export const colorOf = (name: string) => (name === me.name ? me.color : peers.find((x) => x.name === name)?.color ?? C.colorFor(name)); export const sheetLabel = (id: string) => sheetName(id);
export function commentsList(f: C.Filter = {}) { return C.filterThreads(comments, f); }
const canC = () => S.canComment(myRole);
function changedComments(broadcast = true) { saveHook(); syncMarkers(); notify(); if (broadcast && session) session.sendResource('DRACO_COMMENTS', comments); }
export function addComment(text: string, at?: { sheetId: string; r: number; c: number }): Out {
  if (!canC()) return fail('Your role in this session cannot comment'); const cell = at ?? selectionCell(); if (!cell) return fail('Select a cell first');
  const t = C.addThread(comments, { ...cell, author: me.name, text }); if (!t) return fail('Write a comment first'); changedComments(); return { ok: true, message: `Comment added to ${a1(cell.r, cell.c)}`, ...(t ? { id: t.id } : {}) } as Out;
}
export function replyTo(id: string, text: string): Out { if (!canC()) return fail('Your role in this session cannot comment'); const r = C.addReply(comments, id, me.name, text); if (!r) return fail('Write a reply first'); changedComments(); return ok('Reply added'); }
export function resolveThread(id: string, resolved: boolean): Out { if (!canC()) return fail('Your role cannot change comments'); if (!C.setResolved(comments, id, me.name, resolved)) return fail('Thread not found'); changedComments(); return ok(resolved ? 'Resolved' : 'Reopened'); }
export function editComment(id: string, text: string, replyId?: string): Out { if (!canC()) return fail('Your role cannot change comments'); if (!text.trim() || !C.editText(comments, id, text.trim(), replyId)) return fail('Nothing to save'); changedComments(); return ok('Saved'); }
export function deleteComment(id: string, replyId?: string): Out { if (!canC()) return fail('Your role cannot change comments'); const done = replyId ? C.deleteReply(comments, id, replyId) : C.deleteThread(comments, id); if (!done) return fail('Not found'); changedComments(); return ok('Deleted'); }
export function commentsCsv() { return C.threadsToCsv(C.filterThreads(comments, { status: 'all' }), sheetName, a1); }
export function goToCell(sheetId: string, r: number, c: number) { const wb = wbOf(); if (!wb) return; const ws = wb.getSheetBySheetId(sheetId); if (!ws) return; wb.setActiveSheet(ws); ws.getRange(r, c).activate(); }
/** Marker overlays: one small triangle at the top-right of every commented cell. Diffed so we only touch the engine when something changed. */
export function syncMarkers() {
  const wb = wbOf(); if (!wb) return;
  for (const ws0 of wb.getSheets()) {
    const ws = ws0 as unknown as WS; const sid = ws0.getSheetId(); const want = new Map<string, { r: number; c: number; n: number; open: boolean }>();
    for (const t of comments.threads) if (t.sheetId === sid) { const k = `cm-${sid}-${t.r}-${t.c}`; const w = want.get(k) ?? { r: t.r, c: t.c, n: 0, open: false }; w.n += 1 + t.replies.length; w.open = w.open || !t.resolved; want.set(k, w); }
    const have = new Map<string, { id: string; data: { n: number; open: boolean } }>(); for (const f of ws0.getAllFloatDoms()) if (f?.componentKey === MARK_KEY) have.set(f.id, { id: f.id, data: f.data as never });
    for (const [id] of have) if (!want.has(id)) ws0.removeFloatDom(id);
    for (const [id, w] of want) { const h = have.get(id); if (h && h.data.n === w.n && h.data.open === w.open) continue; if (h) ws0.removeFloatDom(id); const o = cellOrigin(ws, w.r, w.c); const cw = ws0.getColumnWidth(w.c); ws0.addFloatDomToPosition({ componentKey: MARK_KEY, data: { n: w.n, open: w.open, sheetId: sid, r: w.r, c: w.c } as never, allowTransform: false, initPosition: { startX: o.left + cw - 12, startY: o.top + 1, endX: o.left + cw - 1, endY: o.top + 12 } }, id); }
  }
}
export let onMarkerClick: (sheetId: string, r: number, c: number) => void = () => undefined; export const setMarkerClick = (fn: typeof onMarkerClick) => { onMarkerClick = fn; };
export const markerClick = (sheetId: string, r: number, c: number) => onMarkerClick(sheetId, r, c);

// ====================== notes (v88) ======================
export interface NoteInfo { sheetId: string; sheet: string; r: number; c: number; text: string; id: string }
export function listNotes(): NoteInfo[] { const wb = wbOf(); if (!wb) return []; const out: NoteInfo[] = []; for (const ws of wb.getSheets()) for (const n of (ws as unknown as { getNotes(): Array<{ id: string; row: number; col: number; note: string }> }).getNotes()) out.push({ sheetId: ws.getSheetId(), sheet: ws.getSheetName(), r: n.row, c: n.col, text: n.note, id: n.id }); return out.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.r - b.r || a.c - b.c); }
export function setNote(text: string, at?: { sheetId: string; r: number; c: number }): Out {
  if (!S.canEdit(myRole)) return fail('Your role cannot edit notes'); const cell = at ?? selectionCell(); const wb = wbOf(); if (!cell || !wb) return fail('Select a cell first'); const ws = wb.getSheetBySheetId(cell.sheetId); if (!ws) return fail('Sheet not found');
  const rg = ws.getRange(cell.r, cell.c) as unknown as { createOrUpdateNote(o: object): unknown; deleteNote(): unknown }; if (!text.trim()) { rg.deleteNote(); notify(); return ok('Note deleted'); } rg.createOrUpdateNote({ note: text, width: 200, height: 90 }); notify(); return ok(`Note saved on ${a1(cell.r, cell.c)}`);
}
export const deleteNote = (n: NoteInfo) => setNote('', { sheetId: n.sheetId, r: n.r, c: n.c });
export function notesCsv(): string { const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s); return [['Sheet', 'Cell', 'Note'], ...listNotes().map((n) => [n.sheet, a1(n.r, n.c), n.text])].map((r) => r.map(q).join(',')).join('\n'); }

// ====================== change log (v91) ======================
let pendingBefore: Array<{ sheetId: string; r: number; c: number; before: string }> | null = null; const MAX_TRACK = 5000;
let tracking = true; export const setTracking = (v: boolean) => { tracking = v; notify(); }; export const isTracking = () => tracking;
type Cells = Record<string, Record<string, { v?: unknown; f?: string; si?: string }>>;
function cellAt(wb: NonNullable<ReturnType<typeof wbOf>>, sheetId: string, r: number, c: number): string { const ws = wb.getSheetBySheetId(sheetId); if (!ws) return ''; const cd = (ws.getRange(r, c).getCellData() ?? null) as { v?: unknown; f?: string } | null; return L.cellText(cd as L.CellLike | null); }
function beforeCommand(id: string, params: unknown) {
  if (id !== 'sheet.mutation.set-range-values' || !tracking) { pendingBefore = null; return; } const p = params as { unitId?: string; subUnitId?: string; cellValue?: Cells }; const wb = wbOf(); if (!wb || !p.cellValue || !p.subUnitId) { pendingBefore = null; return; }
  const list: typeof pendingBefore = []; let n = 0; for (const [r, row] of Object.entries(p.cellValue)) for (const c of Object.keys(row)) { if (++n > MAX_TRACK) { pendingBefore = null; return; } list.push({ sheetId: p.subUnitId, r: +r, c: +c, before: cellAt(wb, p.subUnitId, +r, +c) }); } pendingBefore = list;
}
function afterCommand(id: string, params: unknown, fromRemote: Peer | null) {
  if (id !== 'sheet.mutation.set-range-values' || !tracking || !pendingBefore) return; const list = pendingBefore; pendingBefore = null; const wb = wbOf(); if (!wb) return; const sid = list[0]?.sheetId; if (!sid) return; void params;
  const user = fromRemote ? fromRemote.name : me.name; let changed = false; const nm = sheetName(sid);
  for (const b of list) { const after = cellAt(wb, b.sheetId, b.r, b.c); const ch = L.makeChange({ user, sheetId: b.sheetId, sheet: nm, r: b.r, c: b.c, before: b.before, after, source: fromRemote ? 'remote' : 'local' }); if (ch) { log = L.appendChange(log, ch); changed = true; } }
  if (changed) { notify(); }
}
export const getLog = () => log;
export function clearLog(): Out { log = []; saveHook(); notify(); return ok('Change history cleared'); }
export function logCsv() { return L.logToCsv(log, a1); }
export function revertChanges(ids: string[]): Out {
  const wb = wbOf(); if (!wb) return fail('No workbook'); if (!S.canEdit(myRole)) return fail('Your role cannot edit'); const picked = log.filter((c) => ids.includes(c.id)); const plan = L.planRevert(picked, (c) => cellAt(wb, c.sheetId, c.r, c.c)); let n = 0; const skipped: string[] = [];
  const prevTracking = tracking; tracking = false;
  for (const p of plan) { if (!p.ok) { skipped.push(`${p.change.sheet}!${a1(p.change.r, p.change.c)}: ${p.reason}`); continue; } const ws = wb.getSheetBySheetId(p.change.sheetId); if (!ws) continue; const rg = ws.getRange(p.change.r, p.change.c); const b = p.change.before; if (b.startsWith('=')) rg.setFormula(b); else if (b === '') rg.clear({ contentsOnly: true }); else rg.setValue(b); n++; }
  tracking = prevTracking; const done = plan.filter((p) => p.ok).map((p) => p.change.id); log = log.filter((c) => !done.includes(c.id));
  const rec = L.makeChange; void rec; saveHook(); notify(); return { ok: n > 0, message: `Reverted ${n} change${n === 1 ? '' : 's'}${skipped.length ? `; skipped ${skipped.length}` : ''}`, ...(skipped.length ? { skipped } : {}) } as Out;
}
export function changesSince(iso: string) { const m = L.touchedSince(log, iso); let n = 0; for (const v of m.values()) n += v.length; return { cells: n, sheets: m.size, users: L.users(log.filter((c) => c.at >= iso)) }; }

// ====================== protection (v92) ======================
export const getProtection = (sheetId?: string): P.SheetProtection => prot[sheetId ?? sheetIdOf()] ?? P.emptyProtection();
export const getWbProtection = () => wbProt;
type WSP = { isProtected(): boolean; protect(o?: object): Promise<string>; unprotect(): Promise<boolean>; setReadOnly(): Promise<void>; setEditable(): Promise<void>; setPoint(p: unknown, v: boolean): Promise<void>; protectRanges(c: Array<{ ranges: unknown[]; options?: object }>): Promise<Array<{ id: string }>>; unprotectRules(ids: string[]): Promise<boolean>; listRangeProtectionRules(): Promise<Array<{ id: string }>>; canEdit(): boolean; canEditCell(r: number, c: number): boolean };
async function applySheet(sheetId: string): Promise<void> {
  const wb = wbOf(); const ws = wb?.getSheetBySheetId(sheetId); if (!wb || !ws || !eng) return; const wp = (ws as unknown as { getWorksheetPermission(): WSP }).getWorksheetPermission(); const sp = prot[sheetId]; const E = eng.api.Enum as unknown as { WorksheetPermissionPoint: Record<string, unknown> };
  try { const rules = await wp.listRangeProtectionRules(); if (rules.length) await wp.unprotectRules(rules.map((x) => x.id)); } catch { /* none */ }
  if (!sp?.enabled) { if (wp.isProtected()) await wp.unprotect(); return; }
  if (!wp.isProtected()) await wp.protect({ name: 'Draco sheet protection' }); await wp.setReadOnly();
  const pts = P.pointsFor(sp.allow); for (const [k, v] of Object.entries(pts)) { const pt = E.WorksheetPermissionPoint[k.replace(/^Worksheet/, '')] ?? E.WorksheetPermissionPoint[k]; if (pt !== undefined) await wp.setPoint(pt, v); }
  const rows = ws.getMaxRows(), cols = ws.getMaxColumns(); const un = sp.unlocked.map(P.parseRect).filter(Boolean) as P.Rect[]; if (!un.length) return;
  const comp = P.complementRects(rows, cols, un); const rngs = comp.map((r) => ws.getRange(r.r0, r.c0, r.r1 - r.r0 + 1, r.c1 - r.c0 + 1)); if (!rngs.length) return;
  // Unlocked ranges: re-open edit on the whole sheet but lock the complement via range rules.
  await wp.setEditable(); for (const [k, v] of Object.entries(pts)) { const pt = E.WorksheetPermissionPoint[k.replace(/^Worksheet/, '')] ?? E.WorksheetPermissionPoint[k]; if (pt !== undefined) await wp.setPoint(pt, v); }
  try { await wp.setPoint(E.WorksheetPermissionPoint.Edit, true); } catch { /* point name varies */ }
  const made = await wp.protectRanges([{ ranges: rngs, options: { name: 'Draco locked cells', allowViewByOthers: true } }]); for (const rule of made as unknown as Array<{ setPoint(p: unknown, v: boolean): Promise<void> }>) await rule.setPoint((eng.api.Enum as unknown as { RangePermissionPoint: Record<string, unknown> }).RangePermissionPoint.Edit, false);
}
export async function applyAllProtection() { const wb = wbOf(); if (!wb) return; for (const ws of wb.getSheets()) { const id = ws.getSheetId(); if (prot[id]?.enabled || (ws as unknown as { getWorksheetPermission(): WSP }).getWorksheetPermission().isProtected()) { try { await applySheet(id); } catch { /* best effort */ } } } await applyWb(); notify(); }
async function applyWb() { const wb = wbOf(); if (!wb) return; try { const wp = (wb as unknown as { getWorkbookPermission(): { setPoint(p: unknown, v: boolean): Promise<void> } }).getWorkbookPermission(); const E = eng!.api.Enum as unknown as { WorkbookPermissionPoint: Record<string, unknown> }; for (const k of ['InsertSheet', 'DeleteSheet', 'RenameSheet', 'MoveSheet', 'HideSheet']) { const pt = E.WorkbookPermissionPoint[k]; if (pt !== undefined) await wp.setPoint(pt, !wbProt.enabled); } } catch { /* optional */ } }
export async function protectSheet(o: { password?: string; allow?: Partial<P.Allow>; unlocked?: string[]; sheetId?: string }): Promise<Out> {
  const sid = o.sheetId ?? sheetIdOf(); if (!sid) return fail('No sheet'); const cur = prot[sid]; if (cur?.enabled && cur.hash) return fail('Unprotect the sheet first');
  const bad = (o.unlocked ?? []).filter((x) => !P.parseRect(x)); if (bad.length) return fail(`Not a valid range: ${bad[0]}`);
  const sp: P.SheetProtection = { enabled: true, allow: { ...P.defaultAllow(), ...(o.allow ?? {}) }, unlocked: (o.unlocked ?? []).map((x) => P.rectToA1(P.parseRect(x)!)), locked: [] };
  if (o.password) { sp.salt = P.newSalt(); sp.hash = await P.hashPassword(o.password, sp.salt); } prot[sid] = sp; await applySheet(sid); saveHook(); notify(); return ok('Sheet protected');
}
export async function unprotectSheet(password = '', sheetId?: string): Promise<Out> { const sid = sheetId ?? sheetIdOf(); const sp = prot[sid]; if (!sp?.enabled) return fail('Sheet is not protected'); if (!(await P.verifyPassword(sp, password))) return fail('Incorrect password'); delete prot[sid]; await applySheet(sid); saveHook(); notify(); return ok('Sheet unprotected'); }
export async function protectWorkbook(password?: string): Promise<Out> { if (wbProt.enabled) return fail('Already protected'); wbProt = { enabled: true }; if (password) { wbProt.salt = P.newSalt(); wbProt.hash = await P.hashPassword(password, wbProt.salt); } await applyWb(); saveHook(); notify(); return ok('Workbook structure protected'); }
export async function unprotectWorkbook(password = ''): Promise<Out> { if (!wbProt.enabled) return fail('Not protected'); if (!(await P.verifyPassword({ ...P.emptyProtection(), hash: wbProt.hash, salt: wbProt.salt }, password))) return fail('Incorrect password'); wbProt = { enabled: false }; await applyWb(); saveHook(); notify(); return ok('Workbook structure unprotected'); }
export function canEditCell(r: number, c: number): boolean { const sp = prot[sheetIdOf()]; if (!sp?.enabled) return true; const un = sp.unlocked.map(P.parseRect).filter(Boolean) as P.Rect[]; return P.isLocked(un, r, c); }

// ====================== live session (v89/v90) ======================
const OP_BATCH_LIMIT = 200_000;
export const getPeers = () => peers; export const getRoom = () => room; export const getRole = () => myRole; export const isHost = () => hostMode; export const inSession = () => !!session;
export function sessionInfo() { return { room, role: myRole, host: hostMode, peers: peers.map((p) => ({ id: p.id, name: p.name, color: p.color, role: p.role, host: p.host, sheetId: p.sheetId, sel: p.sel })), active: !!session }; }
let hb = 0; let selPoll = 0; let lastSelKey = ''; let selSub: { dispose(): void } | null = null; let cmdSub: { dispose(): void } | null = null; let hostSnapshot: (() => { title: string; id: string; snap: unknown } | null) = () => null; let joinHandler: (s: { title: string; id: string; snap: unknown }, role: S.Role) => void = () => undefined; let defaultGuestRole: S.Role = 'edit'; let sessionRole: S.Role = 'edit';
export function configureSessions(o: { getSnapshot: () => { title: string; id: string; snap: unknown } | null; onJoin: (s: { title: string; id: string; snap: unknown }, role: S.Role) => void }) { hostSnapshot = o.getSnapshot; joinHandler = o.onJoin; }
function transportFor(code: string) { return supabase && (window as unknown as { __dracoUseCloudRealtime?: boolean }).__dracoUseCloudRealtime ? supabaseTransport(supabase as never, code) : broadcastTransport(code); }
function bindEngine() {
  if (!eng) return; selSub?.dispose();
  selSub = eng.api.addEvent(eng.api.Event.SelectionChanged, () => { sendPresence(); });
  window.clearInterval(selPoll); selPoll = window.setInterval(() => { const rg = wbOf()?.getActiveRange(); if (!rg) return; const k = `${wbOf()!.getActiveSheet().getSheetId()}:${rg.getRow()}:${rg.getColumn()}:${rg.getLastRow()}:${rg.getLastColumn()}`; if (k !== lastSelKey) { lastSelKey = k; sendPresence(); } }, 400);
}
function sendPresence() { if (!session) return; const wb = wbOf(); const rg = wb?.getActiveRange(); if (!wb || !rg) return; session.setPresence(wb.getActiveSheet().getSheetId(), { r: rg.getRow(), c: rg.getColumn(), r2: rg.getLastRow(), c2: rg.getLastColumn() } as Sel); }
function startSession(code: string, host: boolean, wantSnapshot: boolean, role: S.Role) {
  if (session) leaveSession(); room = code; hostMode = host; myRole = host ? 'edit' : role; defaultGuestRole = role; sessionRole = role;
  const tr = transportFor(code);
  session = new Session(tr, { id: me.id + '-' + Math.random().toString(36).slice(2, 6), name: me.name, color: me.color, host }, {
    applyOp: (id, params, from) => { remoteApplying = true; applyingRemote = from ?? null; try { pendingBefore = null; beforeCommand(id, params); const api = eng!.api as unknown as { syncExecuteCommand(id: string, p: unknown, o: unknown): unknown }; api.syncExecuteCommand(id, params, { fromCollab: true }); afterCommand(id, params, from ?? null); } catch { /* an op that no longer applies is dropped; Resync repairs drift */ } finally { remoteApplying = false; applyingRemote = null; } saveHook(); },
    getSnapshot: () => hostSnapshot(),
    onSnapshot: (s) => { joinHandler(s, myRole); schedule(() => { bindEngine(); sendPresence(); }, 400); },
    onPeers: (p) => { peers = p; schedule(() => syncCursors(), 60); notify(); },
    onResource: (name, data) => { if (name === 'DRACO_COMMENTS') { comments = C.mergeStores(comments, data as C.CommentStore); syncMarkers(); saveHook(); notify(); } },
    onRole: (r) => { myRole = r; applyRoleLock(); notify(); },
  }, { defaultRole: role });
  session.start(wantSnapshot, host ? undefined : role); bindEngine(); window.clearInterval(hb); hb = window.setInterval(() => { session?.heartbeat(); sendPresence(); }, HEARTBEAT_MS); applyRoleLock(); notify();
}
export function hostSession(role: S.Role = 'edit'): Out & { room?: string } { if (!wbOf()) return fail('No workbook'); const code = S.makeRoomCode(); startSession(code, true, false, role); return { ok: true, message: 'Live session started', room: code }; }
export function joinSession(input: string, role?: S.Role): Out & { room?: string } { const p = S.parseRoomInput(input); if (!p) return fail('That is not a valid session code or link'); startSession(p.room, false, true, role ?? p.role ?? 'edit'); return { ok: true, message: `Joining ${p.room}…`, room: p.room }; }
export function leaveSession() { if (!session) return; const wb0 = wbOf(); if (wb0) for (const ws of wb0.getSheets()) for (const f of ws.getAllFloatDoms()) if (f?.componentKey === PEER_KEY) ws.removeFloatDom(f.id); window.clearInterval(hb); window.clearInterval(selPoll); selSub?.dispose(); selSub = null; session.leave(); session = null; room = ''; peers = []; hostMode = false; myRole = 'edit'; applyRoleLock(); notify(); }
export function setGuestRole(peerId: string, role: S.Role) { session?.setGuestRole(peerId, role); }
export function setDefaultGuestRole(role: S.Role) { defaultGuestRole = role; session?.setDefaultRole(role); void defaultGuestRole; void sessionRole; }
export function resync() { if (!session || hostMode) return fail('Only a guest can resync'); (session as unknown as { gotSnapshot: boolean }).gotSnapshot = false; session.start(true); return ok('Requested a fresh copy from the host'); }
/** View/comment roles are enforced client-side by making the sheet read-only for the local user. */
function applyRoleLock() {
  const wb = wbOf(); if (!wb) return; const ro = !S.canEdit(myRole); document.body.classList.toggle('draco-readonly', ro);
  try { const wp = (wb as unknown as { getWorkbookPermission(): { setReadOnly(): Promise<void>; setEditable(): Promise<void> } }).getWorkbookPermission(); void (ro ? wp.setReadOnly() : wp.setEditable()); } catch { /* optional */ }
}
/** Collaborators' selections drawn as coloured rectangles with a name tag. */
export function syncCursors() {
  const wb = wbOf(); if (!wb) return;
  for (const ws0 of wb.getSheets()) {
    const ws = ws0 as unknown as WS; const sid = ws0.getSheetId(); const want = new Map<string, { sel: Sel; name: string; color: string }>();
    for (const p of peers) if (p.sheetId === sid && p.sel) want.set(`pc-${p.id}`, { sel: p.sel, name: p.name, color: p.color });
    const have = new Map<string, string>(); for (const f of ws0.getAllFloatDoms()) if (f?.componentKey === PEER_KEY) have.set(f.id, JSON.stringify(f.data));
    for (const [id] of have) if (!want.has(id)) ws0.removeFloatDom(id);
    for (const [id, w] of want) {
      const data = { name: w.name, color: w.color, sel: w.sel }; if (have.get(id) === JSON.stringify(data)) continue; if (have.has(id)) ws0.removeFloatDom(id);
      const o = cellOrigin(ws, w.sel.r, w.sel.c); let wd = 0, ht = 0; for (let c = w.sel.c; c <= Math.min(w.sel.c2, w.sel.c + 60); c++) wd += ws0.getColumnWidth(c); for (let r = w.sel.r; r <= Math.min(w.sel.r2, w.sel.r + 200); r++) ht += ws0.getRowHeight(r);
      ws0.addFloatDomToPosition({ componentKey: PEER_KEY, data: data as never, allowTransform: false, initPosition: { startX: o.left, startY: o.top, endX: o.left + wd, endY: o.top + ht } }, id);
    }
  }
}
export const peersOnSheet = (sheetId: string) => peers.filter((p) => p.sheetId === sheetId && p.sel);

// ====================== command hook ======================
export function onBefore(id: string, params: unknown) { if (!remoteApplying) beforeCommand(id, params); }
export function onCommand(id: string, params: unknown, options: Record<string, unknown> | undefined) {
  if (remoteApplying || options?.fromCollab) return; afterCommand(id, params, null);
  const p = params as { subUnitId?: string; range?: { startRow: number; endRow: number; startColumn: number; endColumn: number } };
  if (p?.subUnitId && p.range) { const r = p.range; if (id === 'sheet.mutation.insert-row') shift(p.subUnitId, 'row', r.startRow, r.endRow - r.startRow + 1, 'insert'); else if (id === 'sheet.mutation.remove-rows') shift(p.subUnitId, 'row', r.startRow, r.endRow - r.startRow + 1, 'remove'); else if (id === 'sheet.mutation.insert-col') shift(p.subUnitId, 'col', r.startColumn, r.endColumn - r.startColumn + 1, 'insert'); else if (id === 'sheet.mutation.remove-col') shift(p.subUnitId, 'col', r.startColumn, r.endColumn - r.startColumn + 1, 'remove'); }
  if (session && shouldBroadcast(id, options) && JSON.stringify(params).length < OP_BATCH_LIMIT) session.sendOp(id, params);
}
function shift(sheetId: string, axis: 'row' | 'col', index: number, count: number, kind: 'insert' | 'remove') { const r = C.shiftAnchors(comments, sheetId, axis, index, count, kind); if (r.moved || r.dropped.length) { saveHook(); syncMarkers(); notify(); } }
export function attach(e: Engine) { eng = e; schedule(() => syncMarkers(), 300); }

// ====================== share links (v90) ======================
export async function makeShareLink(role: S.Role, snap: Record<string, unknown>, title: string): Promise<Out & { url?: string }> {
  const enc = await S.encodeShare({ title, role, snap }); if (!enc.ok) return fail(enc.reason); return { ok: true, message: 'Link ready — anyone with it gets a copy of this workbook as it is now', url: S.shareLink(location.origin + location.pathname, enc.token) };
}
export function makeRoomLink(role: S.Role): Out & { url?: string } { if (!room) return fail('Start a live session first'); return { ok: true, message: 'Session link', url: S.roomLink(location.origin + location.pathname.replace(/\/$/, ''), room, role) }; }
export async function readShareFromHash(): Promise<{ title: string; role: S.Role; snap: Record<string, unknown> } | null> { const t = S.tokenFromHash(location.hash); if (!t) return null; return decodeShare(t); }
async function decodeShare(t: string) { return S.decodeShare(t); }
export function roomFromUrl(): { room: string; role?: S.Role } | null { const q = new URLSearchParams(location.search); const r = q.get('room'); if (!r) return null; return S.parseRoomInput(`?room=${r}&role=${q.get('role') ?? ''}`); }
export function isViewOnlyCopy() { return myRole !== 'edit' && !session; }
export const setReadOnlyCopy = (v: boolean) => { myRole = v ? 'view' : 'edit'; applyRoleLock(); notify(); };

// ====================== test hooks ======================
export function install(w: Record<string, unknown>) {
  w.dracoCollab = { me, setName: setMyName, addComment, replyTo, resolveThread, editComment, deleteComment, comments: () => comments, commentsList, commentsCsv, syncMarkers, addNote: setNote, notes: listNotes, notesCsv, log: () => log, logCsv, revert: revertChanges, clearLog, setTracking, protect: protectSheet, unprotect: unprotectSheet, protectWb: protectWorkbook, unprotectWb: unprotectWorkbook, protection: () => ({ sheets: prot, wb: wbProt }), canEditCell, host: hostSession, join: joinSession, leave: leaveSession, info: sessionInfo, setGuestRole, resync, shareLink: makeShareLink, roomLink: makeRoomLink, applyProtection: applyAllProtection };
}

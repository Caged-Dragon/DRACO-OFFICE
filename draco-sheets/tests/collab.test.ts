import assert from 'node:assert/strict';
import * as C from '../src/collab/comments';
import * as L from '../src/collab/changelog';
import * as P from '../src/collab/protect';
import * as S from '../src/collab/share';
import { Session, MemoryHub, shouldBroadcast, PEER_TTL_MS, type Peer, type Hooks } from '../src/collab/sync';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
const T = (s: string) => new Date(s);
(async () => {
// ---- comments
{ const st = C.emptyStore(); const t = C.addThread(st, { sheetId: 's1', r: 2, c: 3, author: 'Ann', text: 'Check this', now: T('2026-01-01T10:00:00Z') })!; ok(t); ok(C.addThread(st, { sheetId: 's1', r: 0, c: 0, author: 'x', text: '   ' }) === null, 'blank rejected');
  const rp = C.addReply(st, t.id, 'Bob', 'Looks right', T('2026-01-01T10:05:00Z'))!; ok(rp); eq(t.replies.length, 1); ok(C.addReply(st, 'nope', 'a', 'b') === null);
  eq(C.threadsAt(st, 's1', 2, 3).length, 1); eq(C.threadsAt(st, 's1', 2, 4).length, 0);
  ok(C.setResolved(st, t.id, 'Ann', true, T('2026-01-01T11:00:00Z'))); eq(t.resolved, true); eq(t.resolvedBy, 'Ann'); ok(C.setResolved(st, t.id, 'Ann', false)); eq(t.resolved, false); eq(t.resolvedBy, undefined);
  ok(C.editText(st, t.id, 'Check that')); eq(t.text, 'Check that'); eq(t.edited, true); ok(C.editText(st, t.id, 'reply edit', rp.id)); eq(t.replies[0].text, 'reply edit');
  const t2 = C.addThread(st, { sheetId: 's1', r: 5, c: 0, author: 'Bob', text: 'Second' })!; C.setResolved(st, t2.id, 'Bob', true);
  eq(C.summary(st), { open: 1, resolved: 1, total: 2, replies: 1 }); eq(C.filterThreads(st, { status: 'open' }).length, 1); eq(C.filterThreads(st, { author: 'Bob' }).length, 2); eq(C.filterThreads(st, { q: 'second' }).length, 1); eq(C.filterThreads(st, { sheetId: 'zz' }).length, 0);
  // shift anchors
  const r1 = C.shiftAnchors(st, 's1', 'row', 3, 2, 'insert'); eq(r1.moved, 1); eq(t.r, 2); eq(t2.r, 7);
  const r2 = C.shiftAnchors(st, 's1', 'row', 6, 2, 'remove'); eq(r2.dropped.length, 1); eq(r2.dropped[0].id, t2.id); eq(st.threads.length, 1); ok(st.tomb[t2.id]);
  const r3 = C.shiftAnchors(st, 's1', 'col', 0, 1, 'insert'); eq(t.c, 4); const r4 = C.shiftAnchors(st, 's1', 'col', 0, 2, 'remove'); eq(t.c, 2); void r3; void r4;
  const csv = C.threadsToCsv(st.threads, () => 'Sheet1', (r, c) => `R${r}C${c}`); ok(csv.split('\n').length >= 2); ok(csv.includes('Sheet1'));
  eq(C.initials('ashwin raj b'), 'AR'); eq(C.initials(''), '?'); eq(C.colorFor('a'), C.colorFor('a')); }
// merge convergence
{ const a = C.emptyStore(), b = C.emptyStore(); const t = C.addThread(a, { sheetId: 's', r: 0, c: 0, author: 'A', text: 'one', now: T('2026-01-01T00:00:00Z') })!; b.threads.push(JSON.parse(JSON.stringify(t)));
  C.addReply(a, t.id, 'A', 'ra', T('2026-01-01T01:00:00Z')); C.addReply(b, t.id, 'B', 'rb', T('2026-01-01T02:00:00Z')); const t3 = C.addThread(b, { sheetId: 's', r: 1, c: 1, author: 'B', text: 'two', now: T('2026-01-01T03:00:00Z') })!;
  const m1 = C.mergeStores(a, b), m2 = C.mergeStores(b, a); eq(m1.threads.map((x) => x.id).sort(), m2.threads.map((x) => x.id).sort()); eq(m1.threads.find((x) => x.id === t.id)!.replies.length, 2); eq(m2.threads.find((x) => x.id === t.id)!.replies.length, 2);
  // deletion tombstone wins over older copy
  C.deleteThread(b, t3.id, T('2026-01-01T04:00:00Z')); const m3 = C.mergeStores(m1, b); ok(!m3.threads.find((x) => x.id === t3.id), 'deleted stays deleted'); const m4 = C.mergeStores(b, m1); ok(!m4.threads.find((x) => x.id === t3.id));
  ok(C.deleteReply(m1, t.id, m1.threads[0].replies[0].id)); eq(m1.threads[0].replies.length, 1); }
// ---- changelog
{ eq(L.cellText({ v: 5 }), '5'); eq(L.cellText({ f: 'A1+1' }), '=A1+1'); eq(L.cellText({ f: '=A1' }), '=A1'); eq(L.cellText(null), ''); eq(L.cellText({ v: null }), ''); eq(L.cellText({ v: true }), 'true');
  ok(L.makeChange({ user: 'a', sheetId: 's', sheet: 'S', r: 0, c: 0, before: 'x', after: 'x' }) === null);
  eq(L.makeChange({ user: 'a', sheetId: 's', sheet: 'S', r: 0, c: 0, before: '', after: 'x' })!.kind, 'add'); eq(L.makeChange({ user: 'a', sheetId: 's', sheet: 'S', r: 0, c: 0, before: 'x', after: '' })!.kind, 'clear'); eq(L.makeChange({ user: 'a', sheetId: 's', sheet: 'S', r: 0, c: 0, before: 'x', after: 'y' })!.kind, 'edit');
  let log: L.Change[] = []; const mk = (u: string, r: number, b: string, a: string, t: string) => L.makeChange({ user: u, sheetId: 's', sheet: 'S', r, c: 0, before: b, after: a, now: T(t) })!;
  log = L.appendChange(log, mk('A', 0, '', '1', '2026-01-01T00:00:00Z')); log = L.appendChange(log, mk('A', 0, '1', '2', '2026-01-01T00:00:02Z')); eq(log.length, 1); eq(log[0].before, ''); eq(log[0].after, '2');
  log = L.appendChange(log, mk('B', 0, '2', '3', '2026-01-01T00:00:03Z')); eq(log.length, 2); log = L.appendChange(log, mk('A', 0, '3', '4', '2026-01-01T00:01:00Z')); eq(log.length, 3);
  log = L.appendChange(log, mk('A', 1, 'q', 'w', '2026-01-01T00:02:00Z')); eq(L.users(log), ['A', 'B']); eq(L.filterLog(log, { user: 'B' }).length, 1); eq(L.filterLog(log, { since: '2026-01-01T00:01:30Z' }).length, 1); eq(L.filterLog(log, { q: 'w' }).length, 1);
  // cancel-out edit merges to nothing
  let l2: L.Change[] = []; l2 = L.appendChange(l2, mk('A', 0, 'a', 'b', '2026-01-01T00:00:00Z')); l2 = L.appendChange(l2, mk('A', 0, 'b', 'a', '2026-01-01T00:00:01Z')); eq(l2.length, 0);
  // cap
  let big: L.Change[] = []; for (let i = 0; i < L.MAX_LOG + 50; i++) big = L.appendChange(big, mk('A', i, '', 'x', '2026-01-01T00:00:00Z')); eq(big.length, L.MAX_LOG);
  // revert plan
  const cur: Record<number, string> = { 0: '4', 1: 'w' }; const plan = L.planRevert(log, (c) => cur[c.r] ?? ''); const r0 = plan.filter((p) => p.change.r === 0); ok(r0[0].ok); ok(!r0[1].ok); ok(plan.find((p) => p.change.r === 1)!.ok);
  cur[1] = 'zzz'; ok(!L.planRevert(log, (c) => cur[c.r] ?? '').find((p) => p.change.r === 1)!.ok);
  ok(L.logToCsv(log, (r, c) => `A${r + 1}${c}`).startsWith('When,Who,Sheet,Cell')); const ts = L.touchedSince(log, '2026-01-01T00:01:30Z'); eq([...ts.keys()].length, 1); }
// ---- protect
{ const cover = (rows: number, cols: number, un: P.Rect[]) => { const comp = P.complementRects(rows, cols, un); let bad = 0; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const inUn = P.isLocked(un.map(P.normRect), r, c); const inComp = P.isLocked(comp, r, c); if (inUn === inComp) bad++; } for (let i = 0; i < comp.length; i++) for (let j = i + 1; j < comp.length; j++) if (P.rectsOverlap(comp[i], comp[j])) bad++; return bad; };
  eq(cover(10, 8, []), 0); eq(cover(10, 8, [{ r0: 2, c0: 2, r1: 4, c1: 3 }]), 0); eq(cover(10, 8, [{ r0: 0, c0: 0, r1: 9, c1: 7 }]), 0); eq(cover(10, 8, [{ r0: 2, c0: 2, r1: 4, c1: 3 }, { r0: 3, c0: 3, r1: 8, c1: 6 }, { r0: 0, c0: 7, r1: 0, c1: 7 }]), 0);
  eq(cover(1000, 20, [{ r0: 1, c0: 1, r1: 5, c1: 1 }, { r0: 8, c0: 0, r1: 20, c1: 2 }, { r0: 999, c0: 19, r1: 999, c1: 19 }]), 0); eq(P.complementRects(5, 5, [{ r0: 0, c0: 0, r1: 4, c1: 4 }]), []);
  eq(P.parseRect('b2'), { r0: 1, c0: 1, r1: 1, c1: 1 }); eq(P.parseRect('$A$1:C3'), { r0: 0, c0: 0, r1: 2, c1: 2 }); eq(P.parseRect('C3:A1'), { r0: 0, c0: 0, r1: 2, c1: 2 }); eq(P.parseRect('zz'), null); eq(P.parseRect('AA10')!.c0, 26); eq(P.rectToA1({ r0: 0, c0: 0, r1: 0, c1: 0 }), 'A1'); eq(P.rectToA1({ r0: 0, c0: 0, r1: 2, c1: 27 }), 'A1:AB3');
  const pts = P.pointsFor({ ...P.defaultAllow(), sort: true, insertRows: true }); ok(Object.keys(pts).length >= 8); eq(pts.WorksheetSort, true); eq(pts.WorksheetInsertRow, true); eq(pts.WorksheetDeleteRow, false); eq(pts.WorksheetSetCellStyle, false);
  const salt = P.newSalt(); ok(salt.length >= 16); const h = await P.hashPassword('secret', salt); eq(h, await P.hashPassword('secret', salt)); ok(h !== await P.hashPassword('Secret', salt)); ok(h !== await P.hashPassword('secret', salt + 'x'));
  const pr = { ...P.emptyProtection(), enabled: true, salt, hash: h }; ok(await P.verifyPassword(pr, 'secret')); ok(!(await P.verifyPassword(pr, 'nope'))); ok(await P.verifyPassword(P.emptyProtection(), '')); }
// ---- share
{ const a = S.makeRoomCode(); ok(S.validRoom(a)); eq(a.length, 6); ok(!S.validRoom('abc')); ok(!S.validRoom('AAAAA0')); const codes = new Set(Array.from({ length: 200 }, () => S.makeRoomCode())); ok(codes.size > 195);
  eq(S.parseRoomInput(` ${a.toLowerCase()} `), { room: a }); eq(S.parseRoomInput(S.roomLink('https://app.example/', a, 'comment')), { room: a, role: 'comment' }); eq(S.parseRoomInput(`https://x/?room=${a}&role=bogus`), { room: a, role: undefined }); eq(S.parseRoomInput('hello world!'), null);
  ok(S.canEdit('edit') && !S.canEdit('comment') && S.canComment('comment') && !S.canComment('view')); eq(S.roleLabel('view'), 'Can view');
  const snap = { id: 'w', sheets: { a: { cellData: { 0: { 0: { v: 'héllo ✓' } } } } }, n: Array.from({ length: 500 }, (_, i) => i) }; const enc = await S.encodeShare({ title: 'T', role: 'view', snap }); ok(enc.ok); if (enc.ok) { ok(/^[A-Za-z0-9_-]+$/.test(enc.token)); const dec = await S.decodeShare(enc.token); eq(dec!.title, 'T'); eq(dec!.role, 'view'); eq(dec!.snap, snap); const link = S.shareLink('https://x.y/', enc.token); eq(S.tokenFromHash(new URL(link).hash), enc.token); }
  ok((await S.decodeShare('!!!bad')) === null); ok((await S.decodeShare('AAAA')) === null); eq(S.tokenFromHash('#other=1'), null);
  const rnd = Array.from({ length: 200000 }, () => Math.random()); const big = await S.encodeShare({ title: 'B', role: 'edit', snap: { x: rnd } }); ok(!big.ok); }
// ---- sync
{ const hub = new MemoryHub(); let clock = 1000; const tick = () => new Promise((r) => setTimeout(r, 5));
  const mk = (name: string, host: boolean, role: 'view' | 'comment' | 'edit' = 'edit') => { const log: string[] = []; const o = { ops: [] as Array<[string, unknown]>, peers: [] as Peer[], snaps: [] as unknown[], res: [] as string[], role: '' }; const hooks: Hooks = { applyOp: (id, p) => { o.ops.push([id, p]); }, getSnapshot: () => ({ title: name, id: 'wb', snap: { from: name } }), onSnapshot: (s) => { o.snaps.push(s); }, onPeers: (p) => { o.peers = p; }, onResource: (nm) => { o.res.push(nm); }, onRole: (r) => { o.role = r; }, now: () => clock }; void log; const s = new Session(hub.create(), { id: name, name, color: '#f00', host }, hooks, { defaultRole: role }); return { s, o }; };
  const A = mk('A', true); clock = 1000; A.s.start(false); await tick(); clock = 1100; const B = mk('B', false); B.s.start(true); await tick();
  eq(B.o.snaps.length, 1); eq((B.o.snaps[0] as { title: string }).title, 'A'); eq(A.o.peers.map((p) => p.id), ['B']); eq(B.o.peers.map((p) => p.id), ['A']); ok(B.o.peers[0].host);
  ok(A.s.sendOp('sheet.mutation.set-range-values', { x: 1 })); await tick(); eq(B.o.ops.length, 1); eq(A.o.ops.length, 0, 'no echo'); eq(B.o.ops[0][0], 'sheet.mutation.set-range-values');
  ok(B.s.sendOp('m2', { y: 2 })); await tick(); eq(A.o.ops.length, 1);
  // third joiner gets exactly one snapshot even if several answer
  clock = 1200; const Cc = mk('C', false); Cc.s.start(true); await tick(); eq(Cc.o.snaps.length, 1);
  // roles: host downgrades B to view → B cannot send and A ignores forced ops
  A.s.setGuestRole('B', 'view'); await tick(); eq(B.o.role, 'view'); eq(B.s.myRole, 'view'); ok(!B.s.sendOp('m3', {})); eq(A.o.ops.length, 1); eq(A.o.peers.find((p) => p.id === 'B')!.role, 'view');
  // malicious viewer bypass: handle op directly
  const before = A.o.ops.length; A.s.handle({ t: 'op', from: 'B', id: 'evil', params: {} }); eq(A.o.ops.length, before, 'host rejects op from viewer');
  // presence
  B.s.setPresence('sheet1', { r: 1, c: 2, r2: 1, c2: 2 }); await tick(); eq(A.o.peers.find((p) => p.id === 'B')!.sel, { r: 1, c: 2, r2: 1, c2: 2 }); eq(A.o.peers.find((p) => p.id === 'B')!.sheetId, 'sheet1');
  // resource
  A.s.sendResource('DRACO_COMMENTS', { a: 1 }); await tick(); ok(B.o.res.includes('DRACO_COMMENTS'));
  // expiry
  clock += PEER_TTL_MS + 1; A.s.prune(); eq(A.o.peers.length, 0, 'stale peers pruned'); B.s.heartbeat(); await tick(); eq(A.o.peers.map((p) => p.id), ['B']);
  // bye
  B.s.leave(); await tick(); eq(A.o.peers.length, 0); }
// ---- shouldBroadcast
ok(shouldBroadcast('sheet.mutation.set-range-values')); ok(!shouldBroadcast('sheet.command.set-range-values')); ok(!shouldBroadcast('sheet.mutation.set-range-values', { onlyLocal: true })); ok(!shouldBroadcast('sheet.mutation.set-range-values', { fromCollab: true })); ok(!shouldBroadcast('sheet.mutation.set-worksheet-active'));
console.log(`collab.test.ts: ${n} assertions OK`);
})().catch((e) => { console.error(e); process.exit(1); });

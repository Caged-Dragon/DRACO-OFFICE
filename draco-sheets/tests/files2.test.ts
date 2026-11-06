import assert from 'node:assert/strict';
import { htmlToGrid, textToGrid, clipToGrid, cssColor } from '../src/files/clip';
import { snapHash, diffSnapshots, describeDiff, pruneList, shouldCheckpoint, SyncQueue } from '../src/files/versions';
import type { Snap } from '../src/files/model';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
// colors
eq(cssColor('#F00'), '#ff0000'); eq(cssColor('rgb(0, 128, 255)'), '#0080ff'); eq(cssColor('rgba(0,0,0,0)'), undefined); eq(cssColor('red'), '#ff0000'); eq(cssColor('windowtext'), undefined); eq(cssColor('transparent'), undefined); eq(cssColor('#12345'), undefined);
// Excel-style html
const xl = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style><!--
td{padding:0px;font-size:11.0pt;font-family:Calibri;}
.xl65{font-weight:700;background:#FFFF00;mso-pattern:auto;}
.xl66{mso-number-format:"0\\.00%";text-align:center;}
.xl67{color:#FF0000;font-style:italic;border-bottom:.5pt solid windowtext;}
--></style></head><body><table><tr><td class=xl65>Name</td><td class=xl65 colspan=2>Score</td></tr>
<tr><td>Ann</td><td class=xl66 x:num="0.256">25.60%</td><td class=xl67 x:num x:fmla="=B2*2">51.20</td></tr>
<tr><td style="font-weight:bold;text-decoration:underline">B&amp;B</td><td x:num="1234.5" style="mso-number-format:'\\#\\,\\#\\#0\\.00'">1,234.50</td><td x:bool="TRUE">TRUE</td></tr>
<tr><td>007</td><td>1,234</td><td>2024-01-05</td></tr></table></body></html>`;
{ const g = htmlToGrid(xl)!; ok(g); eq(g.source, 'excel'); eq([g.rows, g.cols], [4, 3]); eq(g.cells[0][0]!.v, 'Name'); eq(g.cells[0][0]!.style.bl, 1); eq(g.cells[0][0]!.style.bg, { rgb: '#ffff00' }); eq(g.merges, [{ r: 0, c: 1, rows: 1, cols: 2 }]); eq(g.cells[0][2], null);
  eq(g.cells[1][1]!.v, 0.256); eq(g.cells[1][1]!.style.n, { pattern: '0.00%' }); eq(g.cells[1][1]!.style.ht, 2); eq(g.cells[1][2]!.f, '=B2*2'); eq(g.cells[1][2]!.style.cl, { rgb: '#ff0000' }); eq(g.cells[1][2]!.style.it, 1); eq(g.cells[1][2]!.style.bd!.b!.s, 1);
  eq(g.cells[2][0]!.v, 'B&B'); eq(g.cells[2][0]!.style.bl, 1); eq(g.cells[2][0]!.style.ul, { s: 1 }); eq(g.cells[2][1]!.v, 1234.5); eq(g.cells[2][2]!.v, true); eq(g.cells[3][0]!.v, '007'); eq(g.cells[3][1]!.v, 1234); eq(g.cells[3][2]!.v, '2024-01-05'); }
// Google Sheets html
const gs = `<meta charset='utf-8'><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style><table xmlns="http://www.w3.org/1999/xhtml" data-sheets-root="1"><tbody><tr><td data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Item&quot;}" style="font-weight:bold;background-color:#d9ead3;">Item</td><td data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:42}" style="text-align:right;">42</td></tr><tr><td data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;a\\nb&quot;}">a<br>b</td><td rowspan="2" data-sheets-value="{&quot;1&quot;:4,&quot;4&quot;:true}">TRUE</td></tr><tr><td>x</td></tr></tbody></table>`;
{ const g = htmlToGrid(gs)!; ok(g); eq(g.source, 'sheets'); eq(g.cells[0][0]!.v, 'Item'); eq(g.cells[0][0]!.style.bg, { rgb: '#d9ead3' }); eq(g.cells[0][1]!.v, 42); eq(g.cells[0][1]!.style.ht, 3); eq(g.cells[1][0]!.v, 'a\nb'); eq(g.cells[1][1]!.v, true); eq(g.merges, [{ r: 1, c: 1, rows: 2, cols: 1 }]); eq(g.cells[2][0]!.v, 'x'); eq(g.cells[2][1], null); }
// generic html + th + units
{ const g = htmlToGrid('<table><tr><th>H</th><td style="font-size:16px;color:rgb(10,20,30)">$1,200.50</td><td>(5)</td><td>12%</td></tr></table>')!; eq(g.source, 'html'); eq(g.cells[0][0]!.style.bl, 1); eq(g.cells[0][1]!.v, 1200.5); eq(g.cells[0][1]!.style.n, { pattern: '$#,##0.00' }); eq(g.cells[0][1]!.style.fs, 12); eq(g.cells[0][1]!.style.cl, { rgb: '#0a141e' }); eq(g.cells[0][2]!.v, '(5)'); eq(g.cells[0][3]!.v, 0.12); }
eq(htmlToGrid('<p>no table</p>'), null); eq(htmlToGrid(''), null);
{ const g = htmlToGrid('<table><tr><td><table><tr><td>inner</td></tr></table></td><td>b</td></tr></table>')!; ok(g.rows >= 1); }
// text
{ const g = textToGrid('a\tb\n1\t2.5\n')!; eq([g.rows, g.cols], [2, 2]); eq(g.cells[1][1]!.v, 2.5); eq(textToGrid(''), null); const one = textToGrid('hello')!; eq([one.rows, one.cols, one.cells[0][0]!.v], [1, 1, 'hello']); const ml = textToGrid('l1\nl2')!; eq(ml.rows, 2); eq(clipToGrid(undefined, 'x\ty')!.cols, 2); eq(clipToGrid('<table><tr><td>h</td></tr></table>', 'zzz')!.cells[0][0]!.v, 'h'); eq(clipToGrid('<p>x</p>', 'fallback')!.cells[0][0]!.v, 'fallback'); }
// hash + diff
const base = (): Snap => ({ sheetOrder: ['a', 'b'], styles: { b: { bl: 1 } }, sheets: { a: { id: 'a', name: 'S1', cellData: { 0: { 0: { v: 'x', t: 1 }, 1: { v: 1, t: 2 } }, 1: { 0: { f: '=A1', v: 'x', t: 1 } } } }, b: { id: 'b', name: 'S2', cellData: { 0: { 0: { v: 9, t: 2 } } } } } });
{ const a = base(); eq(snapHash(a), snapHash(base())); const b = base(); b.sheets.a.cellData![0][1].v = 2; ok(snapHash(a) !== snapHash(b)); const c = base(); c.sheets.a.cellData![0][0].s = 'b'; ok(snapHash(a) !== snapHash(c)); const d = base(); d.sheets.a.columnData = { 0: { w: 200 } }; ok(snapHash(a) !== snapHash(d));
  eq(diffSnapshots(a, base()).total, 0); eq(describeDiff(diffSnapshots(a, base())), 'No differences.');
  const x = base(); x.sheets.a.cellData![0][1].v = 5; delete x.sheets.a.cellData![1]; x.sheets.a.cellData![2] = { 0: { v: 'new', t: 1 } }; x.sheets.a.cellData![0][0].s = 'b'; x.sheets.b.name = 'Renamed'; x.sheetOrder.push('c'); x.sheets.c = { id: 'c', name: 'S3' };
  const df = diffSnapshots(a, x); eq(df.changes.map((c) => `${c.kind}:${c.sheet}!${c.addr}`), ['format:S1!A1', 'changed:S1!B1', 'removed:S1!A2', 'added:S1!A3']); eq(df.changes[1], { sheet: 'S1', addr: 'B1', kind: 'changed', before: '1', after: '5' }); eq(df.changes[2].before, '=A1 → x'); eq(df.sheetsRenamed, [{ from: 'S2', to: 'Renamed' }]); eq(df.sheetsAdded, ['S3']); ok(describeDiff(df).includes('1 changed'));
  const y = base(); y.sheetOrder = ['a']; delete y.sheets.b; eq(diffSnapshots(a, y).sheetsRemoved, ['S2']);
  const big = base(); for (let i = 0; i < 700; i++) big.sheets.a.cellData![5 + i] = { 0: { v: i, t: 2 } }; const bd = diffSnapshots(a, big, 100); eq([bd.total, bd.changes.length, bd.truncated], [700, 100, true]); ok(describeDiff(bd).includes('showing first 100')); }
// prune + checkpoint
{ const v = (k: number, kind: 'auto' | 'manual') => ({ key: k, kind, at: new Date(2024, 0, 1, 0, k).toISOString() }); const all = [v(1, 'auto'), v(2, 'manual'), v(3, 'auto'), v(4, 'auto'), v(5, 'auto')]; eq(pruneList(all, 2).map((x) => x.key), [3, 1]); eq(pruneList(all, 10), []); eq(pruneList([v(1, 'manual')], 0), []);
  const now = Date.now(); eq(shouldCheckpoint(undefined, undefined, 'h'), true); eq(shouldCheckpoint(new Date(now - 60_000).toISOString(), 'a', 'b', now), false); eq(shouldCheckpoint(new Date(now - 6 * 60_000).toISOString(), 'a', 'b', now), true); eq(shouldCheckpoint(new Date(now - 6 * 60_000).toISOString(), 'a', 'a', now), false); }
// sync queue
(async () => { let raw: string | null = null; const store = { get: () => raw, set: (v: string) => { raw = v; } }; const q = new SyncQueue(store); q.add('a'); q.add('b'); q.add('a'); eq(q.size(), 2); const q2 = new SyncQueue(store); eq(q2.list().map((x) => x.id), ['a', 'b']);
  const res = await q2.process(async (id) => { if (id === 'b') throw new Error('offline'); }); eq(res.done, ['a']); eq(res.failed, [{ id: 'b', error: 'offline' }]); eq(new SyncQueue(store).list()[0].tries, 1); eq(new SyncQueue(store).list()[0].lastError, 'offline');
  const res2 = await new SyncQueue(store).process(async () => {}); eq(res2.done, ['b']); eq(new SyncQueue(store).size(), 0); raw = '{broken'; eq(new SyncQueue(store).size(), 0); raw = '[{"id":5},{"id":"ok","since":"x","tries":0},null]'; eq(new SyncQueue(store).list().map((x) => x.id), ['ok']);
  console.log(`all ${n} clipboard/versions/queue assertions passed`); })();

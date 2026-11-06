import assert from 'node:assert/strict';
import * as A from '../src/a11y/a11y';
import type { Snap } from '../src/files/model';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
eq(A.contrastRatio('#000000', '#ffffff'), 21); eq(A.contrastRatio('#ffffff', '#ffffff'), 1); eq(A.contrastRatio('#777777', '#ffffff'), 4.48); eq(A.contrastRatio('#767676', '#ffffff'), 4.54); eq(A.contrastRatio('nope', '#fff'), null); eq(A.contrastRatio('#fff', '#000'), 21); eq(A.contrastRatio('FF000000', '#ffffff'), 21);
ok(A.meetsAA(4.5)); ok(!A.meetsAA(4.4)); ok(A.meetsAA(3.1, 18)); ok(A.meetsAA(3.1, 14, true)); ok(!A.meetsAA(3.1, 14, false));
eq(A.parseA11y('{"highContrast":true,"textScale":130,"announce":true}'), { highContrast: true, textScale: 130, reduceMotion: false, announce: true, strongFocus: false }); eq(A.parseA11y('garbage'), A.DEFAULT_A11Y); eq(A.parseA11y('{"textScale":999}').textScale, 100); eq(A.parseA11y(null), A.DEFAULT_A11Y);
eq(A.describeCell({ sheet: 'S', a1: 'B2', value: 5, colHeader: 'Qty', rowHeader: 'Apple' }), 'B2, 5, column Qty, row Apple. S.'); eq(A.describeCell({ sheet: 'S', a1: 'A1', value: null }), 'A1, blank. S.'); eq(A.describeCell({ sheet: 'S', a1: 'C3', value: 3, formula: '=A1+B1', merged: 'C3:D3', hyperlink: 'x', note: 'n', comments: 2 }), 'C3, 3, formula A1+B1, merged C3:D3, link, has note, 2 comments. S.'); eq(A.describeCell({ sheet: 'S', a1: 'A1', value: 'x', display: '1.0', colHeader: '1.0' }), 'A1, 1.0. S.');
const snap: Snap = { sheetOrder: ['a', 'b', 'c'], styles: { low: { cl: { rgb: '#cccccc' } } }, sheets: {
  a: { id: 'a', name: 'Sheet1', cellData: { 0: { 0: { v: 1, t: 2 }, 1: { v: 2, t: 2 } }, 1: { 0: { v: 'x', t: 1, s: 'low' }, 1: { v: 'y', t: 1, s: { fs: 7 } } }, 2: { 0: { v: 3, t: 2 } }, 3: { 0: { v: 3, t: 2 } }, 4: { 0: { v: 3, t: 2 } } }, mergeData: [{ startRow: 5, endRow: 5, startColumn: 0, endColumn: 2 }] },
  b: { id: 'b', name: 'Sales 2024', cellData: { 0: { 0: { v: 'Item', t: 1 }, 1: { v: 'Qty', t: 1, s: { cl: { rgb: '#000000' }, bg: { rgb: '#ffff00' } } } } } },
  c: { id: 'c', name: 'Notes', cellData: {} } } };
const iss = A.checkAccessibility(snap, { links: [{ sheetId: 'b', row: 3, col: 0, text: 'https://x.y', url: 'https://x.y' }, { sheetId: 'b', row: 4, col: 0, text: 'Our site', url: 'https://x.y' }, { sheetId: 'b', row: 5, col: 0, text: '', url: 'https://z.y' }] });
const kinds = iss.map((i) => i.kind); ok(kinds.includes('contrast')); ok(kinds.includes('merged')); ok(kinds.includes('sheetname')); ok(kinds.includes('tinyfont')); ok(kinds.includes('noheader')); ok(kinds.includes('empty')); eq(kinds.filter((k) => k === 'linktext').length, 2);
eq(iss.find((i) => i.kind === 'contrast')!.a1, 'A2'); eq(iss[0].severity, 'error'); ok(iss.every((i) => i.fix)); ok(!iss.some((i) => i.sheet === 'Sales 2024' && i.kind === 'contrast'), 'black on yellow passes');
eq(A.issueSummary(iss).error, 1); const big: Snap = { sheetOrder: ['z'], sheets: { z: { id: 'z', name: 'Data', cellData: Object.fromEntries(Array.from({ length: 400 }, (_, r) => [r, { 0: { v: 'q', t: 1, s: { fs: 6 } } }])) } } }; eq(A.checkAccessibility(big).length, 200, 'report capped');
console.log(`a11y.test.ts: ${n} assertions OK`);

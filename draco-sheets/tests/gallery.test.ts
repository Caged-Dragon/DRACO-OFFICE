import assert from 'node:assert/strict';
import * as T from '../src/gallery/templates';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
eq(T.TEMPLATES.length, 6); eq(new Set(T.TEMPLATES.map((t) => t.id)).size, 6); ok(T.byId('loan')); eq(T.byId('zz'), undefined);
for (const t of T.TEMPLATES) {
  const s = T.buildSnapshot(t, 'wb-' + t.id); eq(s.sheetOrder.length, t.sheets.length); ok(s.name === t.title); const sh = s.sheets[s.sheetOrder[0]]; ok(Object.keys(sh.cellData!).length > 3, t.id); ok(T.usedFormulas(t).length > 3, t.id + ' has formulas');
  eq(T.refsOk(t), [], t.id + ' refs'); ok(T.usedFormulas(t).every((f) => f.startsWith('=')), t.id + ' formulas start with ='); const styleKeys = new Set<string>(); for (const row of Object.values(sh.cellData!)) for (const c of Object.values(row)) if (typeof c.s === 'string') styleKeys.add(c.s); for (const k of styleKeys) ok(s.styles![k], `${t.id}: style ${k} defined`);
  ok(JSON.stringify(s).length < 200000); ok(t.blurb.length > 10);
}
const loan = T.buildSnapshot(T.byId('loan')!, 'x').sheets['x-s1']; eq(loan.cellData![7][1].f, '=-PMT(B5/B7,B6*B7,B4)'); eq(loan.cellData![11][4].f, '=B4'); eq(loan.freeze!.ySplit, 11); eq(loan.columnData![0], { w: 150 });
const b = T.buildSnapshot(T.byId('budget')!, 'b').sheets['b-s1']; eq(b.cellData![4][1], { v: 4000, t: 2, s: 'inputm' }); eq(b.cellData![6][1].f, '=SUM(B5:B6)'); eq(b.cellData![4][0], { v: 'Salary', t: 1 });
console.log(`gallery.test.ts: ${n} assertions OK`);

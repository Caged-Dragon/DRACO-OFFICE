import assert from 'node:assert/strict';
import * as M from '../src/auto/macros';
import { runScript, makeDraco, parseA1, colLetters, SAMPLES, type Call } from '../src/auto/script';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
(async () => {
// ---- macros
ok(M.recordable('sheet.mutation.set-range-values')); ok(!M.recordable('sheet.command.set-range-values')); ok(!M.recordable('sheet.mutation.set-worksheet-active')); ok(!M.recordable('sheet.mutation.set-range-values', { fromCollab: true })); ok(!M.recordable('sheet.mutation.insert-sheet'));
const op = (r: number, c: number, v: unknown, sub = 's1'): M.Op => ({ id: 'sheet.mutation.set-range-values', params: { unitId: 'u', subUnitId: sub, cellValue: { [r]: { [c]: { v } } } } });
let ops: M.Op[] = []; ops = M.pushOp(ops, op(0, 0, 'a')); ops = M.pushOp(ops, op(0, 1, 'b')); ops = M.pushOp(ops, op(1, 0, 'c')); eq(ops.length, 1, 'consecutive set-range-values merge'); eq(M.countCells({ id: '', name: '', at: '', relative: false, anchor: { r: 0, c: 0 }, ops }), 3);
ops = M.pushOp(ops, op(0, 0, 'z')); eq((ops[0].params.cellValue as never)['0']['0'], { v: 'z' }, 'later cell wins');
ops = M.pushOp(ops, op(5, 5, 'x', 's2')); eq(ops.length, 2, 'different sheet does not merge'); ops = M.pushOp(ops, { id: 'sheet.mutation.set-row-hidden', params: { unitId: 'u', subUnitId: 's1', ranges: [{ startRow: 2, endRow: 3, startColumn: 0, endColumn: 0, rangeType: 1 }] } }); eq(ops.length, 3);
const t = M.retarget(ops[0], { unitId: 'U2', subUnitId: 'S9', dr: 10, dc: 2 }); eq(t.params.unitId, 'U2'); eq(t.params.subUnitId, 'S9'); eq(Object.keys(t.params.cellValue as object).sort(), ['10', '11']); eq(Object.keys((t.params.cellValue as never)['10']).sort(), ['2', '3']); eq(((t.params.cellValue as never)['10']['2'] as { v: string }).v, 'z');
eq(ops[0].params.subUnitId, 's1', 'retarget does not mutate'); const rh = M.retarget(ops[2], { unitId: 'U', subUnitId: 'S', dr: 4, dc: 7 }); eq(rh.params.ranges, [{ startRow: 6, endRow: 7, startColumn: 0, endColumn: 0, rangeType: 1 }], 'row-type range shifts rows only');
const neg = M.retarget(op(0, 0, 'q'), { unitId: 'U', subUnitId: 'S', dr: -3, dc: -3 }); eq(Object.keys(neg.params.cellValue as object), [], 'cells shifted off the sheet are dropped');
const col = M.retarget({ id: 'x', params: { unitId: 'u', subUnitId: 's', ranges: [{ startRow: 0, endRow: 1e6, startColumn: 3, endColumn: 4, rangeType: 2 }] } }, { unitId: 'U', subUnitId: 'S', dr: 5, dc: 1 }); eq((col.params.ranges as never)[0], { startRow: 0, endRow: 1e6, startColumn: 4, endColumn: 5, rangeType: 2 });
ok(M.describeOp(op(1, 1, 'q')).startsWith('Set 1 cell (B2)')); ok(M.describeOp({ id: 'sheet.mutation.set-row-hidden', params: {} }).startsWith('Set row hidden'));
const mac = M.newMacro({ name: '  ', relative: true, anchor: { r: 1, c: 1 }, ops }); eq(mac.name, 'Macro'); ok(M.macroToScript(mac).includes('draco.replay')); ok(M.macrosOk([mac])); ok(!M.macrosOk([{ id: 1 }])); ok(!M.macrosOk('x'));
// ---- script helpers
eq(parseA1('B2:A1'), { r0: 0, c0: 0, r1: 1, c1: 1 }); eq(parseA1('$C$3'), { r0: 2, c0: 2, r1: 2, c1: 2 }); eq(parseA1('A'), null); eq(colLetters(27), 'AB');
// ---- script runner with a fake host
const grid: Record<string, unknown> = {}; const calls: string[] = []; const logs: string[] = [];
const host: Call = async (m, a) => { calls.push(m); if (m === 'setValues') { const [, addr, v] = a as [null, string, unknown[][]]; const b = parseA1(addr)!; v.forEach((row, i) => row.forEach((x, j) => { grid[`${colLetters(b.c0 + j)}${b.r0 + i + 1}`] = x; })); return true; } if (m === 'getValues') { const [, addr] = a as [null, string]; const b = parseA1(addr)!; const out: unknown[][] = []; for (let r = b.r0; r <= b.r1; r++) { const row: unknown[] = []; for (let c = b.c0; c <= b.c1; c++) row.push(grid[`${colLetters(c)}${r + 1}`] ?? null); out.push(row); } return out; } if (m === 'selection') return 'A1:B2'; if (m === 'usedRange') return 'A1:B2'; return true; };
const lg = (k: string, t: string) => logs.push(k + ':' + t);
await runScript(`await draco.range('A1:B2').setValues([[1,2],[3,4]]); draco.log('hi', {a:1}); console.warn('w');`, host, lg); eq(grid, { A1: 1, B1: 2, A2: 3, B2: 4 }); eq(logs, ['log:hi {"a":1}', 'warn:w']);
eq(await runScript(`const v = await draco.range('A1:B2').values(); return v.flat().reduce((a,b)=>a+b,0);`, host, lg), 10);
await runScript(`await draco.sheet().range('C1:C3').setValue(7);`, host, lg); eq([grid.C1, grid.C2, grid.C3], [7, 7, 7]);
await runScript(`await draco.range('E5').offset(1,1).setValue('o');`, host, lg); eq(grid.F6, 'o');
for (const bad of [`await draco.range('zz').values()`, `await draco.range('A1').setValues('x')`, `throw new Error('boom')`, `await draco.range('A1').offset(-1,0)`]) { let e = ''; try { await runScript(bad, host, lg); } catch (x) { e = (x as Error).message; } ok(e.length > 0, bad); }
let se = ''; try { await runScript('let = = ;', host, lg); } catch (x) { se = (x as Error).message; } ok(se.startsWith('Syntax error'));
const api = makeDraco(host, lg, { maxCalls: 3 }); let lim = ''; try { for (let i = 0; i < 5; i++) await api.draco.range('A1').values(); } catch (x) { lim = (x as Error).message; } ok(lim.includes('too many requests'));
const t0 = Date.now(); await api.draco.sleep(10); ok(Date.now() - t0 >= 8);
for (const s of SAMPLES) { let e = ''; try { await runScript(s.code, host, lg); } catch (x) { e = (x as Error).message; } ok(e === '' || !e.startsWith('Syntax'), s.name + ': ' + e); }
console.log(`auto.test.ts: ${n} assertions OK`);
})().catch((e) => { console.error(e); process.exit(1); });

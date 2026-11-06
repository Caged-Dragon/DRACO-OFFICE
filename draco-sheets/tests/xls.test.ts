import assert from 'node:assert/strict';
import * as X from '@e965/xlsx';
import { importBytes } from '../src/files/filesGlue';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
(async () => {
  const wb = X.utils.book_new(); const ws = X.utils.aoa_to_sheet([['Item', 'Qty', 'Price'], ['Apple', 3, 1.5], ['Pear', 5, 2.25]]); ws['!ref'] = 'A1:D3'; ws['D2'] = { t: 'n', f: 'B2*C2', v: 4.5 }; ws['C2'].z = '0.00'; X.utils.book_append_sheet(wb, ws, 'Stock'); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['x'], [1]]), 'Second');
  const xls = new Uint8Array(X.write(wb, { type: 'array', bookType: 'xls' }) as ArrayBuffer); ok(xls[0] === 0xd0 && xls[1] === 0xcf, 'is OLE');
  const r = await importBytes('old.xls', xls); eq(r.kind, 'xls'); eq(r.title, 'old'); eq(r.snap.sheetOrder.length, 2); ok(r.warnings.some((w) => /old .xls/.test(w)));
  const s = r.snap as unknown as { sheets: Record<string, { name: string; cellData: Record<string, Record<string, { v?: unknown; f?: string }>> }>; sheetOrder: string[] }; const first = s.sheets[s.sheetOrder[0]]; eq(first.name, 'Stock'); eq(first.cellData['0']['0'].v, 'Item'); eq(first.cellData['1']['1'].v, 3); eq(first.cellData['2']['2'].v, 2.25); eq(first.cellData['1']['3'].v, 4.5);
  let err = ''; try { await importBytes('bad.xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1, 2, 3])); } catch (e) { err = (e as Error).message; } ok(/couldn't be read/.test(err), err);
  console.log(`xls.test.ts: ${n} assertions OK`);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });

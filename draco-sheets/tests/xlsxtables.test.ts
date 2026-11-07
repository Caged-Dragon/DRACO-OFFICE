import { describe, it, expect } from 'vitest';
import { snapshotToXlsx, xlsxToSnapshot } from '../src/files/xlsx';

const mk = () => ({
  id: 'w', name: 'T', appVersion: '1', locale: 'enUS', styles: {}, sheetOrder: ['s1'],
  sheets: { s1: { id: 's1', name: 'Sheet1', rowCount: 100, columnCount: 26, cellData: {
    0: { 0: { v: 'Item' }, 1: { v: 'Units' }, 2: { v: 'Dbl' } },
    1: { 0: { v: 'a' }, 1: { v: 2 }, 2: { v: 4, f: '=B2*2' } },
    2: { 0: { v: 'b' }, 1: { v: 5 }, 2: { v: 10, f: '=B3*2' } },
    3: { 0: { v: 'Total' }, 1: { v: 7, f: '=SUBTOTAL(109,B2:B3)' } } } } },
  resources: [{ name: 'draco.tables', data: JSON.stringify({ tables: [{ id: 'tbl_1', name: 'Sales', sheet: 'Sheet1', r0: 0, c0: 0, r1: 3, c1: 2, headers: ['Item', 'Units', 'Dbl'], style: 2, banded: true, totalRow: true, filter: false, totals: { 1: 'sum' } }], formulas: { 'Sheet1|1|2': '=[@Units]*2', 'Sheet1|2|2': '=[@Units]*2' }, slicerEx: {}, slicers: [] }) }],
}) as never;

describe('xlsx tables round trip', () => {
  it('exports and re-imports a table', async () => {
    const buf = await snapshotToXlsx(mk(), 'T');
    const r = await xlsxToSnapshot(buf);
    const res = (r.snap.resources as Array<{ name: string; data: string }>).find((x) => x.name === 'draco.tables');
    expect(res).toBeTruthy();
    const o = JSON.parse(res!.data);
    expect(o.tables).toHaveLength(1);
    const t = o.tables[0];
    expect(t.name).toBe('Sales'); expect(t.totalRow).toBe(true); expect(t.totals[1]).toBe('sum'); expect(t.headers).toEqual(['Item', 'Units', 'Dbl']);
    expect(t.r0).toBe(0); expect(t.r1).toBe(3); expect(t.style).toBe(2);
    const sh = Object.values(r.snap.sheets)[0] as { cellData: Record<number, Record<number, { f?: string }>> };
    expect(sh.cellData[1][2].f).toMatch(/B\$?2\*2/);
    expect(Object.keys(o.formulas).length).toBeGreaterThan(0);
  });
});

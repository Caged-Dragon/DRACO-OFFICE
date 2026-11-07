import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { writeFileSync } from 'fs';
import { snapshotToXlsx } from '../src/files/xlsx';

const mk = (type: string) => ({
  id: 'w', name: 'T', appVersion: '1', locale: 'enUS', styles: {}, sheetOrder: ['s1'],
  sheets: { s1: { id: 's1', name: 'Sheet1', rowCount: 100, columnCount: 26, cellData: {
    0: { 0: { v: 'M' }, 1: { v: 'A' }, 2: { v: 'B' } }, 1: { 0: { v: 'Jan' }, 1: { v: 3 }, 2: { v: 4 } }, 2: { 0: { v: 'Feb' }, 1: { v: 5 }, 2: { v: 1 } } } } },
  resources: [{ name: 'DRACO_OBJECTS', data: JSON.stringify([{ id: 'c1', key: 'draco-chart', sheet: 's1', left: 200, top: 100, width: 400, height: 250, data: { sheet: 'Sheet1', range: 'A1:C3', type, title: 'T & Co', byRows: false, opts: {} } }]) }],
}) as never;

describe('xlsx native charts', () => {
  for (const t of ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter']) it(`writes ${t}`, async () => {
    const buf = await snapshotToXlsx(mk(t), 'T'); const z = await JSZip.loadAsync(buf);
    expect(z.file('xl/charts/chart1.xml')).toBeTruthy(); expect(z.file('xl/drawings/drawing1.xml')).toBeTruthy();
    expect(await z.file('xl/charts/chart1.xml')!.async('string')).toContain('Sheet1!$B$2:$B$3');
    if (t === 'column') writeFileSync('/tmp/xt/chart-col.xlsx', buf); if (t === 'pie') writeFileSync('/tmp/xt/chart-pie.xlsx', buf);
  });
});

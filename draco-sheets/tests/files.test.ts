import assert from 'node:assert/strict';
import { a1, colName, colIndex, parseA1, parseXml, findAll, textOf, toArgb, fromArgb, usedExtent, type Snap } from '../src/files/model';
import { snapshotToXlsx, xlsxToSnapshot } from '../src/files/xlsx';
import { delimitedToSnapshot, gridToDelimited, gridToJson, gridToSnapshot, jsonToSnapshot, sheetToGrid, snapshotToJson, snapshotToOds, odsToSnapshot, formulaToOds, formulaFromOds } from '../src/files/convert';
let n = 0; const t = (name: string, fn: () => void | Promise<void>) => { tests.push([name, fn]); }; const tests: Array<[string, () => void | Promise<void>]> = [];
const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; };

t('A1 helpers', () => { eq(colName(0), 'A'); eq(colName(25), 'Z'); eq(colName(26), 'AA'); eq(colName(701), 'ZZ'); eq(colIndex('AA'), 26); eq(a1(4, 2), 'C5'); eq(parseA1('$B$7'), { r: 6, c: 1 }); eq(parseA1('zz'), null); });
t('colors', () => { eq(toArgb('#ff0000'), 'FFFF0000'); eq(toArgb('f00'), 'FFFF0000'); eq(fromArgb('FF00FF00'), '#00ff00'); eq(toArgb(undefined), undefined); });
t('xml parser basics', () => { const r = parseXml('<a x="1" y=\'2\'><b>hi &amp; <i>bold</i> there</b><c/><!-- no --><d><![CDATA[<raw>]]></d></a>'); const a = r.kids[0]; eq(a.attrs, { x: '1', y: '2' }); eq(textOf(a.kids[0]), 'hi & bold there'); eq(a.kids[1].tag, 'c'); eq(a.kids[2].text, '<raw>'); eq(findAll(r, 'i').length, 1); });
t('html void tags', () => { const r = parseXml('<table><tr><td>a<br>b</td><td>c</td></tr></table>', true); eq(findAll(r, 'td').length, 2); eq(textOf(findAll(r, 'td')[0], true), 'a\nb'); });

const sample = (): Snap => ({ id: 'x', name: 'T', sheetOrder: ['s1', 's2'], styles: { b: { bl: 1, bg: { rgb: '#ffff00' }, cl: { rgb: '#ff0000' }, ht: 2, bd: { b: { s: 1, cl: { rgb: '#000000' } } } }, p: { n: { pattern: '0.00%' } }, d: { n: { pattern: 'yyyy-mm-dd' } }, w: { tb: 3, vt: 1, it: 1, ul: { s: 1 }, st: { s: 1 }, fs: 14, ff: 'Arial' } },
  sheets: { s1: { id: 's1', name: 'Data', cellData: { 0: { 0: { v: 'Name', t: 1, s: 'b' }, 1: { v: 'Score', t: 1, s: 'b' }, 2: { v: 'Flag', t: 1 } }, 1: { 0: { v: 'Ann', t: 1 }, 1: { v: 0.256, t: 2, s: 'p' }, 2: { v: 1, t: 3 } }, 2: { 0: { v: 'Bob', t: 1, s: 'w' }, 1: { v: 45306, t: 2, s: 'd' }, 2: { v: 0, t: 3 } }, 3: { 1: { f: '=SUM(B2:B3)', v: 45306.256, t: 2 }, 2: { f: '=Other!A1&"x"', v: 'hix', t: 1 } } }, mergeData: [{ startRow: 5, endRow: 5, startColumn: 0, endColumn: 2 }], columnData: { 0: { w: 140 }, 1: { w: 61 } }, rowData: { 1: { h: 40 } }, freeze: { xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 }, tabColor: '#00ff00', showGridlines: 0 },
    s2: { id: 's2', name: 'Other', cellData: { 0: { 0: { v: 'hi', t: 1 } } } } } });
t('xlsx round trip', async () => {
  const buf = await snapshotToXlsx(sample()); eq(buf[0], 0x50); eq(buf[1], 0x4b); // zip magic
  const { snap, warnings } = await xlsxToSnapshot(buf); eq(warnings, []); eq(snap.sheetOrder.length, 2);
  const [a, b] = snap.sheetOrder.map((i) => snap.sheets[i]); eq(a.name, 'Data'); eq(b.name, 'Other');
  const st = (r: number, c: number) => snap.styles![a.cellData![r][c].s as string];
  eq(a.cellData![0][0].v, 'Name'); eq(st(0, 0).bl, 1); eq(st(0, 0).bg, { rgb: '#ffff00' }); eq(st(0, 0).cl, { rgb: '#ff0000' }); eq(st(0, 0).ht, 2); eq(st(0, 0).bd!.b!.s, 1);
  eq(a.cellData![1][1].v, 0.256); eq(st(1, 1).n, { pattern: '0.00%' }); eq(a.cellData![1][2], { v: 1, t: 3 });
  eq(st(2, 0).tb, 3); eq(st(2, 0).vt, 1); eq(st(2, 0).it, 1); eq(st(2, 0).ul, { s: 1 }); eq(st(2, 0).st, { s: 1 }); eq(st(2, 0).fs, 14); eq(st(2, 0).ff, 'Arial');
  eq(a.cellData![2][1].v, 45306); eq(st(2, 1).n, { pattern: 'yyyy-mm-dd' });
  eq(a.cellData![3][1].f, '=SUM(B2:B3)'); eq(a.cellData![3][1].v, 45306.256); eq(a.cellData![3][2].f, '=Other!A1&"x"'); eq(a.cellData![3][2].v, 'hix');
  eq(a.mergeData, [{ startRow: 5, startColumn: 0, endRow: 5, endColumn: 2 }]); eq(a.columnData![0].w, 140); eq(a.columnData![1].w, 61); eq(a.rowData![1].h, 40);
  eq(a.freeze, { xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 }); eq(a.tabColor, '#00ff00'); eq(a.showGridlines, 0);
});
t('xlsx long/duplicate/illegal sheet names', async () => {
  const s = sample(); s.sheets.s2.name = 'Data'; s.sheets.s1.name = 'a/b:c*?[x]'; const { snap } = await xlsxToSnapshot(await snapshotToXlsx(s)); const names = snap.sheetOrder.map((i) => snap.sheets[i].name); eq(names[0], 'a_b_c___x_'); eq(names[1], 'Data');
  const s3 = sample(); s3.sheets.s1.name = 'x'.repeat(40); s3.sheets.s2.name = 'x'.repeat(40); const r3 = await xlsxToSnapshot(await snapshotToXlsx(s3)); const nn = r3.snap.sheetOrder.map((i) => r3.snap.sheets[i].name); eq(nn[0].length, 31); eq(new Set(nn.map((x) => x.toLowerCase())).size, 2);
});
t('xlsx rejects garbage', async () => { let err = ''; try { await xlsxToSnapshot(new Uint8Array([1, 2, 3, 4])); } catch (e) { err = (e as Error).message; } assert.match(err, /valid \.xlsx/); n++; });
t('xlsx macro warning', async () => { const r = await xlsxToSnapshot(await snapshotToXlsx(sample()), 'm', { macroFile: true }); assert.match(r.warnings[0], /Macros/); n++; });
t('xlsx empty-ish sheet', async () => { const s: Snap = { sheetOrder: ['a'], sheets: { a: { id: 'a', name: 'E' } } }; const r = await xlsxToSnapshot(await snapshotToXlsx(s)); eq(r.snap.sheets[r.snap.sheetOrder[0]].name, 'E'); eq(usedExtent(r.snap.sheets[r.snap.sheetOrder[0]]), { r: -1, c: -1 }); });
t('xlsx styled-only cells keep style', async () => { const s: Snap = { styles: { y: { bg: { rgb: '#00ff00' } } }, sheetOrder: ['a'], sheets: { a: { id: 'a', name: 'E', cellData: { 2: { 2: { s: 'y' } } } } } }; const r = await xlsxToSnapshot(await snapshotToXlsx(s)); const c = r.snap.sheets[r.snap.sheetOrder[0]].cellData![2][2]; eq(r.snap.styles![c.s as string].bg, { rgb: '#00ff00' }); });
t('xlsx unicode and long text', async () => { const s: Snap = { sheetOrder: ['a'], sheets: { a: { id: 'a', name: 'U', cellData: { 0: { 0: { v: 'héllo 日本語 😀', t: 1 }, 1: { v: 'x'.repeat(5000), t: 1 }, 2: { v: 'line1\nline2', t: 1 } } } } } }; const r = await xlsxToSnapshot(await snapshotToXlsx(s)); const c = r.snap.sheets[r.snap.sheetOrder[0]].cellData![0]; eq(c[0].v, 'héllo 日本語 😀'); eq((c[1].v as string).length, 5000); eq(c[2].v, 'line1\nline2'); });

t('csv export quoting', () => { eq(gridToDelimited([['a', 'b,c', 'd"e'], [1, null, true], ['x\ny', ' pad', '']]), 'a,"b,c","d""e"\r\n1,,TRUE\r\n"x\ny"," pad",\r\n'); eq(gridToDelimited([['a', 'b']], '\t'), 'a\tb\r\n'); eq(gridToDelimited([['é']], ',', { bom: true }).charCodeAt(0), 0xfeff); eq(gridToDelimited([['a']], ',', { eol: '\n', quoteAll: true }), '"a"\n'); eq(gridToDelimited([]), ''); });
t('csv import types', () => {
  const s = delimitedToSnapshot('name,qty,when,ok\nAnn,5,2024-01-15,TRUE\n"B, Jr",2.5,,false\n'); const sh = s.sheets[s.sheetOrder[0]]; const g = sheetToGrid(sh);
  eq(g[0], ['name', 'qty', 'when', 'ok']); eq(g[1][0], 'Ann'); eq(g[1][1], 5); eq(g[1][2], 45306); eq(g[2][0], 'B, Jr'); eq(g[2][1], 2.5); eq(g[2][2], null);
  eq(s.styles!['__date'].n!.pattern, 'yyyy-mm-dd'); eq(sh.cellData![1][2].s, '__date');
});
t('csv round trip with tsv + semicolons', () => { const g = sheetToGrid(Object.values(delimitedToSnapshot('a;b\n1;2\n', ';').sheets)[0]); eq(g, [['a', 'b'], [1, 2]]); const g2 = sheetToGrid(Object.values(delimitedToSnapshot('a\tb\n1\t2', '\t').sheets)[0]); eq(g2, [['a', 'b'], [1, 2]]); });
t('csv leading zeros / long numbers stay text-safe?', () => { const g = sheetToGrid(Object.values(delimitedToSnapshot('id\n007\n').sheets)[0]); eq(typeof g[1][0], 'string'); eq(g[1][0], '007'); });
t('json export headers/dupes/blank', () => { eq(JSON.parse(gridToJson([['a', 'a', null], [1, 2, 3], [null, null, null]])), [{ a: 1, a_2: 2, Column3: 3 }]); eq(JSON.parse(gridToJson([['a'], [1]], { header: false })), [['a'], [1]]); eq(gridToJson([], { header: true }), '[]'); });
t('json all sheets', () => { const j = JSON.parse(snapshotToJson(sample(), { header: true, allSheets: true })); eq(Object.keys(j), ['Data', 'Other']); eq(j.Data[0].Name, 'Ann'); });
t('json import', () => { const s = jsonToSnapshot('[{"a":1,"b":{"c":"x"}},{"a":2,"b":{"c":"y"}}]'); eq(sheetToGrid(Object.values(s.sheets)[0]), [['a', 'b.c'], [1, 'x'], [2, 'y']]); const s2 = jsonToSnapshot('{"rows":[[1,2],[3,4]]}'); eq(sheetToGrid(Object.values(s2.sheets)[0]).length >= 2, true); });

t('formula to ODS', () => { eq(formulaToOds('=SUM(A1:B2)'), 'of:=SUM([.A1:.B2])'); eq(formulaToOds('=A1+$B$2*3'), 'of:=[.A1]+[.$B$2]*3'); eq(formulaToOds('=IF(A1>1,"a,b",Sheet2!C3)'), 'of:=IF([.A1]>1;"a,b";[$Sheet2.C3])'); eq(formulaToOds("='My Sheet'!A1:B2"), "of:=[$'My Sheet'.A1:.B2]"); eq(formulaToOds('=LOG10(A1)'), 'of:=LOG10([.A1])'); eq(formulaToOds('=Total+1'), 'of:=Total+1'); });
t('formula from ODS', () => { eq(formulaFromOds('of:=SUM([.A1:.B2])'), '=SUM(A1:B2)'); eq(formulaFromOds('of:=IF([.A1]>1;"a;b";[$Sheet2.C3])'), '=IF(A1>1,"a;b",Sheet2!C3)'); eq(formulaFromOds("of:=[$'My Sheet'.A1:.B2]"), "='My Sheet'!A1:B2"); eq(formulaFromOds('of:=[.$B$2]*2'), '=$B$2*2'); });
t('ods round trip', async () => {
  const buf = await snapshotToOds(sample()); eq(buf[0], 0x50); const { snap } = await odsToSnapshot(buf); eq(snap.sheetOrder.length, 2);
  const [a, b] = snap.sheetOrder.map((i) => snap.sheets[i]); eq(a.name, 'Data'); eq(b.cellData![0][0].v, 'hi');
  const st = (r: number, c: number) => snap.styles![a.cellData![r][c].s as string] ?? {};
  eq(a.cellData![0][0].v, 'Name'); eq(st(0, 0).bl, 1); eq(st(0, 0).bg, { rgb: '#ffff00' }); eq(st(0, 0).cl, { rgb: '#ff0000' }); eq(st(0, 0).ht, 2);
  eq(a.cellData![1][1].v, 0.256); eq(a.cellData![1][2], { v: 1, t: 3 }); eq(a.cellData![2][1].v, 45306);
  eq(a.cellData![3][1].f, '=SUM(B2:B3)'); eq(a.cellData![3][2].f, '=Other!A1&"x"');
  eq(a.mergeData, [{ startRow: 5, startColumn: 0, endRow: 5, endColumn: 2 }]); eq(Math.abs((a.columnData![0].w ?? 0) - 140) <= 1, true); eq(Math.abs((a.rowData![1].h ?? 0) - 40) <= 1, true);
  eq(st(2, 0).tb, 3); eq(st(2, 0).it, 1); eq(st(2, 0).fs, 14);
});
t('ods multi-line + escapes', async () => { const s: Snap = { sheetOrder: ['a'], sheets: { a: { id: 'a', name: 'A&B', cellData: { 0: { 0: { v: 'x<y & "z"\nline2', t: 1 } } } } } }; const r = await odsToSnapshot(await snapshotToOds(s)); const sh = r.snap.sheets[r.snap.sheetOrder[0]]; eq(sh.name, 'A&B'); eq(sh.cellData![0][0].v, 'x<y & "z"\nline2'); });
t('ods repeated cells and dates', async () => { const JSZip = (await import('jszip')).default; const z = new JSZip(); z.file('content.xml', '<office:document-content xmlns:office="o" xmlns:table="t" xmlns:text="x"><office:body><office:spreadsheet><table:table table:name="S"><table:table-row><table:table-cell office:value-type="float" office:value="7" table:number-columns-repeated="3"/><table:table-cell office:value-type="date" office:date-value="2024-01-15"/><table:table-cell office:value-type="percentage" office:value="0.5"/></table:table-row><table:table-row table:number-rows-repeated="500"><table:table-cell/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>'); const r = await odsToSnapshot(await z.generateAsync({ type: 'uint8array' })); const c = r.snap.sheets[r.snap.sheetOrder[0]].cellData![0]; eq([c[0].v, c[1].v, c[2].v, c[3].v, c[4].v], [7, 7, 7, 45306, 0.5]); eq(r.snap.styles![c[3].s as string].n, { pattern: 'yyyy-mm-dd' }); eq(r.snap.styles![c[4].s as string].n, { pattern: '0%' }); });
t('ods rejects garbage', async () => { let err = ''; try { await odsToSnapshot(new Uint8Array([9, 9, 9])); } catch (e) { err = (e as Error).message; } assert.match(err, /valid \.ods/); n++; });
t('gridToSnapshot sizes', () => { const s = gridToSnapshot([[1, 2], [3, 4]]); const sh = Object.values(s.sheets)[0]; eq(sh.rowCount! >= 1000, true); eq(usedExtent(sh), { r: 1, c: 1 }); });

(async () => { for (const [name, fn] of tests) { try { await fn(); } catch (e) { console.log('FAIL', name, (e as Error).message.split('\n').slice(0, 6).join('\n')); process.exitCode = 1; } } if (!process.exitCode) console.log(`all ${n} file-converter assertions passed (${tests.length} tests)`); })();

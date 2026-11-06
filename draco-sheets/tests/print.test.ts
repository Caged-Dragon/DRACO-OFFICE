import assert from 'node:assert/strict';
import { formatNumber, formatDate, displayText, isDatePattern } from '../src/files/format';
import { layoutSheet, renderPages, expandHF, parseArea, parseTitleRows, parseTitleCols, pageToSvg, printHtml, textW, defaultSetup, mergeSetup } from '../src/files/print';
import { pagesToPdf, pdfString } from '../src/files/pdf';
import type { Snap, SheetSnap } from '../src/files/model';
import { writeFileSync } from 'node:fs';
let n = 0; const eq = (a: unknown, b: unknown, m?: string) => { assert.deepEqual(a, b, m); n++; }; const ok = (c: unknown, m?: string) => { assert.ok(c, m); n++; };
const f = formatNumber;
// number formats
eq(f(1234.5, 'General'), '1234.5'); eq(f(0.1 + 0.2, undefined), '0.3'); eq(f(1e12, 'General'), '1E+12'); eq(f(5, '0'), '5'); eq(f(5.567, '0.00'), '5.57'); eq(f(1234567.891, '#,##0'), '1,234,568'); eq(f(1234567.891, '#,##0.00'), '1,234,567.89');
eq(f(0.256, '0%'), '26%'); eq(f(0.256, '0.00%'), '25.60%'); eq(f(1234.5, '$#,##0.00'), '$1,234.50'); eq(f(-1234.5, '$#,##0.00'), '-$1,234.50'); eq(f(-5, '0;(0)'), '(5)'); eq(f(0, '0;-0;"zero"'), 'zero'); eq(f(7, '000'), '007'); eq(f(3.14159, '0.0'), '3.1');
eq(f(1500, '#,##0,"K"'), '2K'); eq(f(12345.678, '0.00E+00'), '1.23E+04'); eq(f(5, '0 "units"'), '5 units'); eq(f(0.5, '#.##'), '.5'); eq(f(1234, '[$€-407]#,##0'), '€1,234');
// dates
eq(formatDate(45306, 'yyyy-mm-dd'), '2024-01-15'); eq(formatDate(45306, 'm/d/yyyy'), '1/15/2024'); eq(formatDate(45306, 'dd-mmm-yy'), '15-Jan-24'); eq(formatDate(45306, 'mmmm d, yyyy'), 'January 15, 2024'); eq(formatDate(45306, 'dddd'), 'Monday'); eq(formatDate(45306.75, 'yyyy-mm-dd hh:mm:ss'), '2024-01-15 18:00:00'); eq(formatDate(45306.75, 'h:mm AM/PM'), '6:00 PM'); eq(formatDate(0.5, 'hh:mm'), '12:00'); eq(formatDate(1.5, '[h]:mm'), '36:00');
ok(isDatePattern('yyyy-mm-dd')); ok(!isDatePattern('0.00')); ok(!isDatePattern('#,##0')); eq(f(45306, 'yyyy-mm-dd'), '2024-01-15'); eq(displayText(true), 'TRUE'); eq(displayText(null), ''); eq(displayText('x', '0.00'), 'x'); eq(displayText(2, '0.0'), '2.0');
// header/footer
const ctx = { page: 2, pages: 5, sheet: 'S1', file: 'Book', now: new Date(2024, 0, 15, 15, 5) };
eq(expandHF('Page &P of &N', ctx), 'Page 2 of 5'); eq(expandHF('&F - &A', ctx), 'Book - S1'); eq(expandHF('&D &T', ctx), '1/15/2024 3:05 PM'); eq(expandHF('R&&D', ctx), 'R&D'); eq(expandHF('&B&"Arial,Bold"x&I', ctx), 'x');
// areas
eq(parseArea('B2:D5'), { r0: 1, c0: 1, r1: 4, c1: 3 }); eq(parseArea('$A$1'), { r0: 0, c0: 0, r1: 0, c1: 0 }); eq(parseArea('D5:B2'), { r0: 1, c0: 1, r1: 4, c1: 3 }); eq(parseArea('zzz'), null); eq(parseArea(''), null); eq(parseTitleRows('1:2'), [0, 1]); eq(parseTitleRows('$3'), [2, 2]); eq(parseTitleRows('0'), null); eq(parseTitleCols('A:B'), [0, 1]); eq(parseTitleCols('$C'), [2, 2]);

const mk = (rows: number, cols: number, extra: Partial<SheetSnap> = {}): { snap: Snap; sh: SheetSnap } => { const cellData: Record<string, Record<string, any>> = {}; for (let r = 0; r < rows; r++) { cellData[r] = {}; for (let c = 0; c < cols; c++) cellData[r][c] = r === 0 ? { v: `H${c + 1}`, t: 1, s: 'h' } : { v: r * 100 + c, t: 2 }; } const sh: SheetSnap = { id: 's', name: 'Sheet1', cellData, ...extra }; return { snap: { sheetOrder: ['s'], sheets: { s: sh }, styles: { h: { bl: 1, bg: { rgb: '#ddeeff' }, bd: { b: { s: 1, cl: { rgb: '#000000' } } } } } }, sh }; };
{ // layout
  const { sh } = mk(10, 3); const L = layoutSheet(sh); eq(L.pages.length, 1); eq(L.paper, [612, 792]); eq(L.area, { r0: 0, c0: 0, r1: 9, c1: 2 }); eq(L.scale, 1);
  const land = layoutSheet(sh, { orientation: 'landscape', paper: 'a4' }); eq(land.paper, [842, 595]);
  eq(layoutSheet({ id: 'e', name: 'E' }).error?.includes('empty'), true);
  const big = mk(100, 3).sh; const L2 = layoutSheet(big); ok(L2.pages.length >= 3, 'rows split'); eq(L2.pages.every((p) => p.cols.length === 3), true); eq(L2.pages.flatMap((p) => p.rows).length, 100); eq(new Set(L2.pages.flatMap((p) => p.rows)).size, 100);
  const wide = mk(5, 20).sh; const L3 = layoutSheet(wide); ok(L3.pages.length >= 2); eq(L3.pages.flatMap((p) => p.cols).length, 20);
  // order
  const both = mk(100, 20).sh; const down = layoutSheet(both, { pageOrder: 'down' }), over = layoutSheet(both, { pageOrder: 'over' }); eq(down.pages.length, over.pages.length); eq(down.pages[1].band, { r: 1, c: 0 }); eq(over.pages[1].band, { r: 0, c: 1 });
  // fit to 1 page wide
  const fit = layoutSheet(wide, { useFit: true, fitW: 1, fitH: 0 }); eq(fit.pages.length, 1); ok(fit.scale < 1);
  const fit2 = layoutSheet(both, { useFit: true, fitW: 1, fitH: 1 }); eq(fit2.pages.length, 1);
  const sc = layoutSheet(wide, { scale: 50 }); ok(sc.pages.length < L3.pages.length || L3.pages.length === 1);
  // print area
  const pa = layoutSheet(big, { printArea: 'A1:B10' }); eq(pa.pages.length, 1); eq(pa.pages[0].rows.length, 10); eq(pa.pages[0].cols, [0, 1]);
  const bad = layoutSheet(big, { printArea: 'nonsense' }); ok(bad.warnings[0].includes('valid')); eq(bad.area.r1, 99);
  // title rows repeat
  const tr = layoutSheet(big, { titleRows: '1:1' }); ok(tr.pages.length >= 2); eq(tr.pages.every((p) => p.rows[0] === 0), true); eq(tr.pages[1].rows[0], 0); eq(tr.pages[1].rows[1] > 1, true);
  const tc = layoutSheet(wide, { titleCols: 'A:A' }); eq(tc.pages.every((p) => p.cols[0] === 0), true);
  // manual breaks
  const br = layoutSheet(mk(30, 3).sh, { rowBreaks: [10, 20] }); eq(br.pages.map((p) => p.rows.length), [10, 10, 10]); const cb = layoutSheet(mk(5, 6).sh, { colBreaks: [2, 4] }); eq(cb.pages.map((p) => p.cols.length), [2, 2, 2]);
  // hidden rows/cols skipped
  const hid = layoutSheet(mk(5, 3, { rowData: { 2: { hd: 1 } }, columnData: { 1: { hd: 1 } } }).sh); eq(hid.pages[0].rows, [0, 1, 3, 4]); eq(hid.pages[0].cols, [0, 2]);
  // margins too big
  ok(layoutSheet(sh, { margins: { t: 6, b: 6, l: 1, r: 1, header: 0.3, footer: 0.3 } }).error);
  eq(mergeSetup({ margins: { t: 1 } as never }).margins.l, 0.7); eq(defaultSetup().paper, 'letter');
}
{ // rendering
  const { snap, sh } = mk(60, 4, { mergeData: [{ startRow: 2, endRow: 2, startColumn: 0, endColumn: 2 }] }); const r = renderPages({ snap, sheet: sh, setup: { footer: { l: '', c: 'Page &P of &N', r: '&A' }, header: { l: '&F', c: '', r: '' }, gridlines: true, headings: true, titleRows: '1' }, fileName: 'My.xlsx', now: new Date(2024, 0, 1) });
  ok(r.pages.length >= 2); const p0 = r.pages[0]; ok(p0.ops.some((o) => o.k === 'rect' && o.fill === '#ddeeff'), 'header fill'); ok(p0.ops.some((o) => o.k === 'text' && o.text === 'H1' && o.bold)); ok(p0.ops.some((o) => o.k === 'text' && o.text === `Page 1 of ${r.pages.length}`)); ok(p0.ops.some((o) => o.k === 'text' && o.text === 'Sheet1')); ok(p0.ops.some((o) => o.k === 'text' && o.text === 'My.xlsx'));
  ok(p0.ops.some((o) => o.k === 'text' && o.text === 'A') && p0.ops.some((o) => o.k === 'text' && o.text === '1'), 'headings'); ok(p0.ops.some((o) => o.k === 'line' && o.color === '#bfbfbf'), 'gridlines'); ok(p0.ops.some((o) => o.k === 'line' && o.color === '#000000'), 'border');
  const t = (o: any) => o.k === 'text'; const num = p0.ops.find((o) => t(o) && (o as any).text === '102' ) as any; ok(num && num.x > 40, 'numbers right-aligned'); 
  ok(r.pages[1].ops.some((o) => t(o) && (o as any).text === 'H1'), 'title row repeats on page 2');
  const svg = pageToSvg(p0); ok(svg.startsWith('<svg') && svg.includes('H1') && svg.includes('clipPath')); ok(printHtml(r.pages, 'T').includes('@page{size:612pt 792pt')); ok(!/<script/i.test(svg));
  // display override + wrap + overflow
  const s2: SheetSnap = { id: 's', name: 'W', cellData: { 0: { 0: { v: 'a long label that overflows', t: 1 }, 2: { v: 'x', t: 1 } }, 1: { 0: { v: 'wrap this text over lines', t: 1, s: 'w' } } }, columnData: { 0: { w: 60 } } }; const w = renderPages({ snap: { sheetOrder: ['s'], sheets: { s: s2 }, styles: { w: { tb: 3 } } }, sheet: s2 });
  const txts = w.pages[0].ops.filter((o) => o.k === 'text') as any[]; ok(txts.filter((o) => o.y > 25).length >= 2, 'wrapped lines'); const ov = txts.find((o) => o.text.startsWith('a long')); ok(ov.clip.w > 60, 'overflow clip widened into empty neighbour');
  const d = renderPages({ snap, sheet: sh, display: () => 'ZZ' }); ok(d.pages[0].ops.some((o) => o.k === 'text' && o.text === 'ZZ'));
  const bw = renderPages({ snap, sheet: sh, setup: { blackWhite: true } }); ok(bw.pages[0].ops.some((o) => o.k === 'rect' && /^#([0-9a-f]{2})\1\1$/.test(o.fill)), 'grayscale');
  const cen = renderPages({ snap: mk(2, 2).snap, sheet: mk(2, 2).sh, setup: { centerH: true, centerV: true } }); const first = cen.pages[0].ops.find((o) => o.k === 'text') as any; ok(first.x > 150 && first.y > 200, 'centered');
}
// text metrics + pdf
ok(Math.abs(textW('Hello', 10) - 22.78) < 0.1); ok(textW('Hello', 10, true) > textW('Hello', 10)); eq(textW('', 10), 0);
eq(pdfString('a(b)c\\d'), 'a\\(b\\)c\\\\d'); eq(pdfString('é€—'), '\\351\\200\\227'); eq(pdfString('日'), '?'); eq(pdfString('a\nb'), 'a b');
{ const { snap, sh } = mk(80, 5); const r = renderPages({ snap, sheet: sh, setup: { gridlines: true } }); const pdf = pagesToPdf(r.pages, 'T(est)'); const s = Buffer.from(pdf).toString('latin1'); ok(s.startsWith('%PDF-1.4')); ok(s.trimEnd().endsWith('%%EOF')); eq((s.match(/\/Type \/Page /g) ?? []).length, r.pages.length); ok(s.includes('/Count ' + r.pages.length));
  const sx = +/startxref\n(\d+)/.exec(s)![1]; eq(s.slice(sx, sx + 4), 'xref'); const offs = [...s.slice(sx).matchAll(/(\d{10}) 00000 n/g)].map((m) => +m[1]); ok(offs.every((o, i) => s.slice(o).startsWith(`${i + 1} 0 obj`)), 'xref offsets exact'); ok(s.includes('Title (T\\(est\\))'));
  writeFileSync('/tmp/print-test.pdf', pdf); eq(pagesToPdf([]).length > 200, true); }
console.log(`all ${n} print/format/pdf assertions passed`);

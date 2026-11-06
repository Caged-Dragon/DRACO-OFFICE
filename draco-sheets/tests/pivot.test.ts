import { computePivot, prepareSource, defaultConfig, aggregate, parseCalc, evalCalc, parseDateText, dateToSerial, serialToDate, fieldItems, valueTitle, type PivotConfig, type Cell } from '../src/pivot/pivot';
let fails = 0, passes = 0;
const eq = (n: string, g: unknown, w: unknown) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? passes++ : fails++; if (!ok) console.log('FAIL', n, '\n  got ', JSON.stringify(g), '\n  want', JSON.stringify(w)); };
const near = (n: string, g: unknown, w: number) => { const ok = typeof g === 'number' && Math.abs(g - w) < 1e-9; ok ? passes++ : fails++; if (!ok) console.log('FAIL', n, 'got', g, 'want', w); };
const data: Cell[][] = [['Region', 'Product', 'Date', 'Sales', 'Cost'], ['East', 'Apple', '2024-01-15', 100, 60], ['East', 'Pear', '2024-02-10', 50, 30], ['West', 'Apple', '2024-01-20', 200, 120], ['West', 'Apple', '2024-04-05', 150, 90], ['West', 'Pear', '2024-05-01', 80, 50], ['North', 'Pear', '2024-05-20', 70, 40]];
const src = prepareSource(data);
const cfg = (p: Partial<PivotConfig>): PivotConfig => ({ ...defaultConfig(), ...p });
const V = (f: string, agg: 'sum' = 'sum', extra = {}) => ({ field: f, agg, ...extra });
const col = (g: ReturnType<typeof computePivot>, c: number) => g.grid.map((r) => r[c].v);
const row = (g: ReturnType<typeof computePivot>, r: number) => g.grid[r].map((c) => c.v);
// prepareSource
eq('fields incl. virtual date fields', src.fields, ['Region', 'Product', 'Date', 'Sales', 'Cost', 'Date (Years)', 'Date (Quarters)', 'Date (Months)']);
eq('date detected', src.dateFields, ['Date']); eq('virtual values', src.rows[0].slice(5), ['2024', 'Qtr1', 'Jan']);
eq('dup/blank headers unique', prepareSource([['a', 'a', ''], [1, 2, 3]]).fields, ['a', 'a2', 'Column3']);
eq('blank rows dropped', prepareSource([['a'], [null], [''], [1]]).rows.length, 1);
// 1. rows only
let r = computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')] }));
eq('rows: labels sorted + grand', col(r, 0), ['Row Labels', 'East', 'North', 'West', 'Grand Total']); eq('rows: sums', col(r, 1), ['Sum of Sales', 150, 70, 430, 650]); eq('rows: record count', r.recordCount, 6);
eq('rows: header title', r.grid[0][1].v, 'Sum of Sales');
// 2. rows x cols with grand totals
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [V('Sales')] }));
eq('cross: header rows', [row(r, 0), row(r, 1)], [['Sum of Sales', 'Column Labels', null, null], ['Row Labels', 'Apple', 'Pear', 'Grand Total']]);
eq('cross: East', row(r, 2), ['East', 100, 50, 150]); eq('cross: North (missing Apple)', row(r, 3), ['North', null, 70, 70]); eq('cross: West', row(r, 4), ['West', 350, 80, 430]); eq('cross: grand row', row(r, 5), ['Grand Total', 450, 200, 650]);
eq('cross: dataRect excludes totals', r.dataRect, { r0: 2, c0: 1, r1: 4, c1: 2 }); eq('cross: headRows', r.headRows, 2);
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [V('Sales')], emptyText: '-' })); eq('emptyText', row(r, 3), ['North', '-', 70, 70]);
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [V('Sales')], grandRows: false, grandCols: false })); eq('no grand totals', [r.cols, r.grid.length], [3, 5]);
// 3. multiple values
r = computePivot(src, cfg({ rows: ['Region'], values: [V('Sales'), V('Cost')] })); eq('multi values header', row(r, 0), ['Row Labels', 'Sum of Sales', 'Sum of Cost']); eq('multi values body', row(r, 3), ['West', 430, 260]);
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [V('Sales'), V('Cost')] })); eq('multi values x cols header', [row(r, 1), row(r, 2)], [['', 'Apple', '', 'Pear', '', 'Grand Total', ''], ['Row Labels', 'Sum of Sales', 'Sum of Cost', 'Sum of Sales', 'Sum of Cost', 'Sum of Sales', 'Sum of Cost']]); eq('multi x cols East', row(r, 3), ['East', 100, 60, 50, 30, 150, 90]);
// 4. aggregations
const agg = (a: string) => computePivot(src, cfg({ rows: ['Region'], values: [{ field: 'Sales', agg: a as never }] })).grid[3][1].v;
eq('count', agg('count'), 3); eq('counta', agg('counta'), 3); near('average', agg('average'), 430 / 3); eq('max', agg('max'), 200); eq('min', agg('min'), 80); eq('product', agg('product'), 200 * 150 * 80); eq('distinct', agg('distinct'), 3);
near('stdev', agg('stdev'), Math.sqrt(((200 - 430 / 3) ** 2 + (150 - 430 / 3) ** 2 + (80 - 430 / 3) ** 2) / 2)); near('stdevp', agg('stdevp'), Math.sqrt(((200 - 430 / 3) ** 2 + (150 - 430 / 3) ** 2 + (80 - 430 / 3) ** 2) / 3)); near('varp', agg('varp'), ((200 - 430 / 3) ** 2 + (150 - 430 / 3) ** 2 + (80 - 430 / 3) ** 2) / 3);
eq('stdev of 1 -> null', aggregate('stdev', [5]), null); eq('sum of text -> 0', aggregate('sum', ['a', 'b']), 0); eq('count text', aggregate('counta', ['a', '', null, 'b']), 2); eq('numeric text sums', aggregate('sum', ['1,200', '$5']), 1205);
// 5. show-as
const sa = (as: string, extra: Partial<PivotConfig> = {}) => computePivot(src, cfg({ rows: ['Region'], values: [{ field: 'Sales', agg: 'sum', as: as as never }], ...extra }));
near('% of grand', sa('pctGrand').grid[1][1].v, 150 / 650); near('% grand total itself', sa('pctGrand').grid[4][1].v, 1); eq('pct format', sa('pctGrand').grid[1][1].fmt, '0.00%');
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [{ field: 'Sales', agg: 'sum', as: 'pctCol' }] })); near('% of column (East Apple)', r.grid[2][1].v, 100 / 450); near('% of col grand', r.grid[5][1].v, 1);
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [{ field: 'Sales', agg: 'sum', as: 'pctRow' }] })); near('% of row (East Apple)', r.grid[2][1].v, 100 / 150); near('% of row total col', r.grid[2][3].v, 1);
eq('diff from previous', col(sa('diffPrev'), 1).slice(1, 4), ['', -80, 360]); near('% diff from previous', sa('pctDiffPrev').grid[3][1].v, (430 - 70) / 70);
eq('running total', col(sa('running'), 1).slice(1, 4), [150, 220, 650]); eq('rank desc', col(sa('rankDesc'), 1).slice(1, 4), [2, 3, 1]); eq('rank asc', col(sa('rankAsc'), 1).slice(1, 4), [2, 1, 3]);
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product'], values: [{ field: 'Sales', agg: 'sum', as: 'index' }] })); near('index East Apple', r.grid[2][1].v, (100 * 650) / (150 * 450));
// 6. sorting / top N
eq('sort desc by label', col(computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], sort: { Region: 'desc' } })), 0).slice(1, 4), ['West', 'North', 'East']);
eq('sort by value desc', col(computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], sortByValue: { Region: 'desc' } })), 0).slice(1, 4), ['West', 'East', 'North']);
eq('sort by value asc', col(computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], sortByValue: { Region: 'asc' } })), 0).slice(1, 4), ['North', 'East', 'West']);
eq('top 2', col(computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], sortByValue: { Region: 'desc' }, top: { field: 'Region', n: 2, dir: 'top' } })), 0).slice(1, 3), ['West', 'East']);
eq('bottom 1', col(computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], top: { field: 'Region', n: 1, dir: 'bottom' } })), 0).slice(1, 2), ['North']);
// 7. filters / timeline
r = computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], filters: [{ field: 'Product', exclude: ['Pear'] }] })); eq('filter exclude Pear', [col(r, 0), col(r, 1)], [['Row Labels', 'East', 'West', 'Grand Total'], ['Sum of Sales', 100, 350, 450]]);
r = computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], filters: [{ field: 'Product', exclude: ['Pear'] }, { field: 'Region', exclude: ['West'] }] })); eq('two filters', col(r, 1), ['Sum of Sales', 100, 100]);
r = computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], timeline: { field: 'Date', from: dateToSerial(2024, 2, 1), to: dateToSerial(2024, 5, 1) } })); eq('timeline Feb..May1', [col(r, 0), col(r, 1)], [['Row Labels', 'East', 'West', 'Grand Total'], ['Sum of Sales', 50, 230, 280]]);
eq('all filtered out -> only grand', computePivot(src, cfg({ rows: ['Region'], values: [V('Sales')], filters: [{ field: 'Region', exclude: ['East', 'West', 'North'] }] })).recordCount, 0);
// 8. date grouping (virtual fields)
r = computePivot(src, cfg({ rows: ['Date (Months)'], values: [V('Sales')] })); eq('months in calendar order', col(r, 0), ['Row Labels', 'Jan', 'Feb', 'Apr', 'May', 'Grand Total']); eq('months sums', col(r, 1), ['Sum of Sales', 300, 50, 150, 150, 650]);
r = computePivot(src, cfg({ rows: ['Date (Quarters)'], values: [V('Sales')] })); eq('quarters', [col(r, 0), col(r, 1)], [['Row Labels', 'Qtr1', 'Qtr2', 'Grand Total'], ['Sum of Sales', 350, 300, 650]]);
r = computePivot(src, cfg({ rows: ['Date (Years)', 'Date (Quarters)'], values: [V('Sales')] })); eq('years>quarters compact', col(r, 0), ['Row Labels', '2024', 'Qtr1', 'Qtr2', 'Grand Total']);
// serial dates
const ser = prepareSource([['D', 'x'], [dateToSerial(2023, 12, 31), 1], [dateToSerial(2024, 1, 1), 2]], [0]); eq('serial date col flagged', ser.rows.map((x) => x.slice(2)), [['2023', 'Qtr4', 'Dec'], ['2024', 'Qtr1', 'Jan']]);
eq('serial roundtrip', serialToDate(dateToSerial(2024, 2, 29)).toISOString().slice(0, 10), '2024-02-29');
eq('parse dates', [parseDateText('2024-03-05'), parseDateText('3/5/2024'), parseDateText('05 Mar 2024'), parseDateText('2024-13-01'), parseDateText('hello'), parseDateText('2/30/2024')], [dateToSerial(2024, 3, 5), dateToSerial(2024, 3, 5), dateToSerial(2024, 3, 5), null, null, null]);
// 9. number bins
r = computePivot(src, cfg({ rows: ['Sales'], values: [{ field: 'Sales', agg: 'count' }], bins: { Sales: { start: 0, step: 100 } } })); eq('number bins', [col(r, 0), col(r, 1)], [['Row Labels', '0-99', '100-199', '200-299', 'Grand Total'], ['Count numbers of Sales'.replace('Count numbers of', 'Count numbers of'), 3, 2, 1, 6]]);
// 10. calculated fields
r = computePivot(src, cfg({ rows: ['Region'], values: [V('Profit')], calc: [{ name: 'Profit', formula: 'Sales - Cost' }] })); eq('calc profit', col(r, 1), ['Sum of Profit', 60, 30, 170, 260]);
r = computePivot(src, cfg({ rows: ['Region'], values: [{ field: 'Margin', agg: 'sum', name: 'Margin' }], calc: [{ name: 'Margin', formula: '(Sales - Cost) / Sales' }] })); near('calc margin on sums (grand)', r.grid[4][1].v, 260 / 650); near('calc margin East', r.grid[1][1].v, 60 / 150);
r = computePivot(src, cfg({ rows: ['Region'], values: [V('X')], calc: [{ name: 'X', formula: 'Sales +' }] })); eq('bad calc reports error', typeof r.error, 'string');
r = computePivot(src, cfg({ rows: ['Region'], values: [V('X')], calc: [{ name: 'X', formula: 'Nope * 2' }] })); eq('unknown field in calc', r.error?.includes('Nope') ?? false, true);
eq('calc parser precedence', evalCalc(parseCalc('Sales + Cost * 2 ^ 2', ['Sales', 'Cost']), (f) => (f === 'Sales' ? 10 : 3)), 22); eq('calc unary & parens', evalCalc(parseCalc('-(Sales - Cost)', ['Sales', 'Cost']), (f) => (f === 'Sales' ? 10 : 3)), -7); eq('calc quoted name with space', evalCalc(parseCalc("'Unit Price' * 2", ['Unit Price']), () => 4), 8); eq('calc names with space unquoted', evalCalc(parseCalc('Unit Price * 2', ['Unit Price']), () => 4), 8);
eq('calc div by zero NaN', Number.isNaN(evalCalc(parseCalc('Sales / Cost', ['Sales', 'Cost']), (f) => (f === 'Sales' ? 1 : 0))), true);
// 11. layouts
r = computePivot(src, cfg({ rows: ['Region', 'Product'], values: [V('Sales')] })); eq('compact 2-level labels', col(r, 0), ['Row Labels', 'East', 'Apple', 'Pear', 'North', 'Pear', 'West', 'Apple', 'Pear', 'Grand Total']); eq('compact group carries subtotal', col(r, 1), ['Sum of Sales', 150, 100, 50, 70, 70, 430, 350, 80, 650]); eq('compact indent', [r.grid[1][0].indent, r.grid[2][0].indent], [0, 1]);
r = computePivot(src, cfg({ rows: ['Region', 'Product'], values: [V('Sales')], subtotals: false })); eq('no subtotals blanks group rows', col(r, 1), ['Sum of Sales', null, 100, 50, null, 70, null, 350, 80, 650]);
r = computePivot(src, cfg({ rows: ['Region', 'Product'], values: [V('Sales')], layout: 'tabular' })); eq('tabular labels col0', col(r, 0), ['Region', 'East', 'East', 'East Total', 'North', 'North Total', 'West', 'West', 'West Total', 'Grand Total']); eq('tabular labels col1', col(r, 1), ['Product', 'Apple', 'Pear', null, 'Pear', null, 'Apple', 'Pear', null, null]); eq('tabular values', col(r, 2), ['Sum of Sales', 100, 50, 150, 70, 70, 350, 80, 430, 650]);
r = computePivot(src, cfg({ rows: ['Region', 'Product'], values: [V('Sales')], layout: 'outline' })); eq('outline col0', col(r, 0), ['Region', 'East', null, null, 'North', null, 'West', null, null, 'Grand Total']); eq('outline col1', col(r, 1), ['Product', null, 'Apple', 'Pear', null, 'Pear', null, 'Apple', 'Pear', null]);
// 12. col subtotals with 2 col fields
r = computePivot(src, cfg({ rows: ['Region'], cols: ['Product', 'Date (Quarters)'], values: [V('Sales')] })); eq('2-level cols header 0', row(r, 1), ['', 'Apple', '', 'Apple Total', 'Pear', '', 'Pear Total', 'Grand Total']); eq('2-level cols header 1', row(r, 2), ['Row Labels', 'Qtr1', 'Qtr2', '', 'Qtr1', 'Qtr2', '', '']); eq('2-level West', row(r, 5), ['West', 200, 150, 350, null, 80, 80, 430]);
// 13. no rows
r = computePivot(src, cfg({ values: [V('Sales'), V('Cost')] })); eq('values only', r.grid.map((x) => x.map((c) => c.v)), [['', 'Sum of Sales', 'Sum of Cost'], ['Grand Total', 650, 390]]);
r = computePivot(src, cfg({ cols: ['Product'], values: [V('Sales')] })); eq('cols only', r.grid.map((x) => x.map((c) => c.v)), [['Sum of Sales', 'Column Labels', null, null], ['', 'Apple', 'Pear', 'Grand Total'], ['Grand Total', 450, 200, 650]]);
// errors / edge
eq('no values -> error', computePivot(src, cfg({ rows: ['Region'] })).error, 'Add at least one value field.'); eq('unknown field -> error', computePivot(src, cfg({ rows: ['Zip'], values: [V('Sales')] })).error?.includes('Zip'), true);
const blanks = prepareSource([['k', 'v'], ['a', 1], [null, 2], ['', 3]]); eq('blank key group', col(computePivot(blanks, cfg({ rows: ['k'], values: [V('v')] })), 0), ['Row Labels', 'a', '(blank)', 'Grand Total']); eq('blank sums', col(computePivot(blanks, cfg({ rows: ['k'], values: [V('v')] })), 1), ['Sum of v', 1, 5, 6]);
eq('empty source', computePivot(prepareSource([['a', 'b']]), cfg({ rows: ['a'], values: [V('b')] })).grid.length >= 1, true);
eq('valueTitle', [valueTitle({ field: 'Sales', agg: 'average' }), valueTitle({ field: 'Sales', agg: 'sum', name: 'Total $' })], ['Average of Sales', 'Total $']);
eq('fieldItems sorted', fieldItems(src, 'Region'), ['East', 'North', 'West']); eq('fieldItems months', fieldItems(src, 'Date (Months)'), ['Jan', 'Feb', 'Apr', 'May']); eq('fieldItems bins', fieldItems(src, 'Sales', { start: 0, step: 100 }), ['0-99', '100-199', '200-299']);
eq('grid is rectangular', (() => { const g = computePivot(src, cfg({ rows: ['Region', 'Product'], cols: ['Date (Quarters)'], values: [V('Sales'), V('Cost')], layout: 'tabular' })).grid; return g.every((x) => x.length === g[0].length); })(), true);
console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `all ${passes} pivot tests passed`); process.exit(fails ? 1 : 0);

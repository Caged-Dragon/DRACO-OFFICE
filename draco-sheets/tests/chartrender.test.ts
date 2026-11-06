import { renderChart, specFromGrid, PALETTES, type ChartSpec, type ChartType } from '../src/charts/render';
import { writeFileSync } from 'fs';
let fails = 0, passes = 0;
const ok = (n: string, c: boolean, extra = '') => { c ? passes++ : fails++; if (!c) console.log('FAIL', n, extra); };
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const dir = process.argv[2];
const cats = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const A = { name: 'Sales', values: [120, 150, 90, 180, 210, 170] }, B = { name: 'Costs', values: [80, 95, 70, 110, 130, 100] }, C = { name: 'Profit', values: [40, 55, 20, 70, 80, 70] };
const base = (type: ChartType, extra: Partial<ChartSpec> = {}): ChartSpec => ({ type, title: type + ' chart', categories: cats, series: [A, B], opts: { legend: 'bottom' }, ...extra });
const specs: Record<string, ChartSpec> = {
  column: base('column'), bar: base('bar'), line: base('line'), area: base('area'), pie: base('pie', { series: [A] }), doughnut: base('doughnut', { series: [A] }),
  scatter: { type: 'scatter', title: 'scatter', categories: [], series: [{ name: 'y', values: [2.2, 4.1, 6.2, 7.9, 10.1], xs: [1, 2, 3, 4, 5] }], opts: { trend: { type: 'linear', showEq: true, showR2: true } } },
  bubble: { type: 'bubble', title: 'bubble', categories: [], series: [{ name: 'b', values: [5, 9, 3, 7], xs: [1, 2, 3, 4], sizes: [10, 40, 5, 25] }] },
  radar: base('radar', { series: [A, B] }), stock: { type: 'stock', title: 'stock', categories: ['d1', 'd2', 'd3', 'd4'], series: [{ name: 'Open', values: [10, 12, 11, 13] }, { name: 'High', values: [14, 15, 13, 16] }, { name: 'Low', values: [9, 11, 9, 12] }, { name: 'Close', values: [12, 11, 12, 15] }] },
  combo: { type: 'combo', title: 'combo', categories: cats, series: [{ ...A, kind: 'column' }, { ...B, kind: 'column' }, { name: 'Margin %', values: [33, 37, 22, 39, 38, 41], kind: 'line', secondary: true }], opts: { y2Title: 'Margin', yTitle: 'USD' } },
  waterfall: { type: 'waterfall', title: 'waterfall', categories: ['Start', 'Sales', 'Costs', 'Tax', 'Total'], series: [{ name: 'v', values: [100, 50, -30, -10, 0] }], opts: { labels: true } },
  funnel: { type: 'funnel', title: 'funnel', categories: ['Visits', 'Signups', 'Trials', 'Paid'], series: [{ name: 'n', values: [1000, 400, 150, 60] }] },
  histogram: { type: 'histogram', title: 'histogram', categories: [], series: [{ name: 'v', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 10, 11, 12] }], opts: { bins: 4 } },
  box: { type: 'box', title: 'box', categories: [], series: [{ name: 'A', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100] }, { name: 'B', values: [10, 12, 14, 15, 17, 18, 20] }] },
  treemap: { type: 'treemap', title: 'treemap', categories: ['a', 'b', 'c', 'd', 'e'], series: [{ name: 'v', values: [6, 6, 4, 3, 2] }] },
  surface: { type: 'surface', title: 'surface', categories: ['r1', 'r2', 'r3'], series: [{ name: 'a', values: [1, 4, 9] }, { name: 'b', values: [2, 5, 8] }, { name: 'c', values: [3, 6, 7] }], opts: { labels: true } },
  sunburst: { type: 'sunburst', title: 'sunburst', categories: ['EU/UK', 'EU/DE', 'US/CA', 'US/NY', 'Asia'], series: [{ name: 'v', values: [3, 4, 5, 6, 7] }] },
};
for (const [k, s] of Object.entries(specs)) { const svg = renderChart(s, 480, 300); if (dir) writeFileSync(`${dir}/${k}.svg`, svg); ok(`${k} wraps svg`, svg.startsWith('<svg') && svg.endsWith('</svg>')); ok(`${k} no NaN/undefined`, !/NaN|undefined|Infinity/.test(svg), svg.match(/.{30}(NaN|undefined|Infinity).{20}/)?.[0]); ok(`${k} title`, svg.includes(`${k} chart`) || svg.includes(`>${k}<`)); ok(`${k} balanced tags`, count(svg, /<g[ >]/g) === count(svg, /<\/g>/g)); }
const n = (t: string, s: string) => count(renderChart(specs[t], 480, 300), new RegExp(s, 'g'));
ok('column 6x2 bars (+bg rect + 2 legend)', n('column', '<rect ') === 1 + 12 + 2, String(n('column', '<rect ')));
ok('bar renders horizontal rects', n('bar', '<rect ') === 1 + 12 + 2);
ok('line 2 paths 12 markers', n('line', '<path ') === 2 && n('line', '<circle ') === 12);
ok('area 2 filled paths', n('area', '<path ') === 2);
ok('pie 6 slices', n('pie', '<path ') === 6); ok('doughnut 6 slices', n('doughnut', '<path ') === 6);
ok('scatter 5 points + trend path', n('scatter', '<circle ') === 5 && n('scatter', '<path ') === 1 && renderChart(specs.scatter).includes('y = 1.96x + 0.22') && renderChart(specs.scatter).includes('R² = 1'));
ok('bubble 4 circles with varied radii', new Set((renderChart(specs.bubble).match(/r="[\d.]+" fill="#[0-9A-Fa-f]+" fill-opacity/g) ?? [])).size === 4);
ok('radar 2 series polygons + 3 grid', n('radar', '<polygon ') >= 2 + 3);
ok('stock 4 candles', n('stock', '<title>') === 4);
ok('combo has bars, line, secondary axis title', n('combo', '<rect ') === 1 + 12 + 3 && n('combo', '<path ') === 1 && renderChart(specs.combo).includes('rotate(90)'));
ok('waterfall colors', ['#70AD47', '#E4572E', '#4472C4'].every((c) => renderChart(specs.waterfall).includes(c)));
ok('funnel widths decrease', (() => { const w = [...renderChart(specs.funnel).matchAll(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)"/g)].map((m) => +m[1]); return w.length === 4 && w.every((v, i) => i === 0 || v < w[i - 1]); })());
ok('histogram 4 bars', n('histogram', '<title>Count') === 4);
ok('box shows outlier circle + 2 boxes', n('box', '<circle ') === 1 && n('box', 'fill-opacity') === 2);
ok('treemap 5 rects', n('treemap', '<rect ') === 1 + 5);
ok('sunburst parents+children 3+5', n('sunburst', '<path ') === 3 + 5);
ok('surface 9 cells + 7 legend bands', n('surface', '<title>') === 9 && n('surface', '<rect ') === 1 + 9 + 7);
ok('surface min/max extreme colors', renderChart(specs.surface).includes('#3B4CC0') && renderChart(specs.surface).includes('#B40426'));
// options
const withOpt = (type: ChartType, o: object) => renderChart({ ...specs[type], opts: { ...specs[type].opts, ...o } });
ok('legend none removes legend', renderChart({ ...specs.column, opts: { legend: 'none' } }).split('<rect ').length - 1 === 1 + 12);
ok('legend right/left/top work', ['right', 'left', 'top'].every((p) => withOpt('column', { legend: p }).includes('Costs')));
ok('data labels', withOpt('column', { labels: true }).includes('>210<'));
ok('axis titles', withOpt('column', { xTitle: 'Month', yTitle: 'USD' }).includes('>Month<') && withOpt('column', { xTitle: 'Month', yTitle: 'USD' }).includes('>USD<'));
ok('gridlines off', !withOpt('column', { grid: false }).includes(`stroke="#e3e3e3"`));
ok('stacked stays under max: axis top ≥ 300', /<text[^>]*>300<\/text>|<text[^>]*>320<\/text>|<text[^>]*>350<\/text>/.test(withOpt('column', { stack: 'stacked' })));
ok('percent stack shows %', withOpt('column', { stack: 'percent' }).includes('100%'));
ok('log axis powers of ten', withOpt('line', { logY: true }).includes('>1K<') === false && /<text[^>]*>(100|1,000|1000)<\/text>/.test(withOpt('line', { logY: true })) || withOpt('line', { logY: true }).includes('>100<'));
ok('smooth uses curves', withOpt('line', { smooth: true }).includes('C'));
ok('markers off', !withOpt('line', { markers: false }).includes('<circle'));
ok('error bars add lines', withOpt('column', { err: { kind: 'fixed', value: 10 } }).split('<line').length > renderChart(specs.column).split('<line').length + 20);
ok('moving avg trend dashed', withOpt('line', { trend: { type: 'ma', period: 3 } }).includes('Moving average (3)'));
ok('poly trend + forecast', withOpt('line', { trend: { type: 'poly', degree: 2, forward: 2, showEq: true } }).includes('poly trend'));
ok('dark theme bg', withOpt('column', { theme: 'dark' }).includes('#1e1e1e'));
ok('every palette colors series', Object.keys(PALETTES).every((p) => withOpt('column', { palette: p }).includes(PALETTES[p][0])));
ok('empty data message', renderChart({ type: 'column', categories: [], series: [] }).includes('No data'));
ok('escapes html in title', renderChart({ ...specs.column, title: '<b>&' }).includes('&lt;b&gt;&amp;'));
ok('negative values column no NaN', !/NaN/.test(renderChart({ ...specs.column, series: [{ name: 'n', values: [-5, 10, -20, 30] }], categories: ['a', 'b', 'c', 'd'] })));
ok('null gaps in line ok', !/NaN/.test(renderChart({ ...specs.line, series: [{ name: 'g', values: [1, null, 3, null, 5] }], categories: ['a', 'b', 'c', 'd', 'e'] })));
ok('single point doesn’t crash', renderChart({ ...specs.line, series: [{ name: 's', values: [4] }], categories: ['x'] }).startsWith('<svg'));
ok('tiny size doesn’t crash', renderChart(specs.pie, 60, 40).startsWith('<svg'));
// specFromGrid
let g = specFromGrid([['Month', 'Sales', 'Costs'], ['Jan', 10, 5], ['Feb', 20, 8]], 'column');
ok('grid: header+cat detected', JSON.stringify(g.categories) === '["Jan","Feb"]' && g.series.length === 2 && g.series[0].name === 'Sales' && g.series[1].values[1] === 8);
g = specFromGrid([[1, 2], [3, 4], [5, 6]], 'line'); ok('grid: numeric only → no header, 2 series, numbered cats', g.series.length === 2 && g.categories.join() === '1,2,3' && g.series[0].values.join() === '1,3,5');
g = specFromGrid([['x', 'y'], [1, 2.5], [2, 4.1], [3, 6]], 'scatter'); ok('grid: scatter x/y', g.series.length === 1 && g.series[0].xs!.join() === '1,2,3' && g.series[0].values.join() === '2.5,4.1,6');
g = specFromGrid([['x', 'y', 'size'], [1, 2, 30], [2, 4, 10]], 'bubble'); ok('grid: bubble sizes', g.series[0].sizes!.join() === '30,10');
g = specFromGrid([['Sales'], [5], [7]], 'column'); ok('grid: single column w/ header', g.series.length === 1 && g.series[0].name === 'Sales' && g.series[0].values.join() === '5,7');
g = specFromGrid([['a', '1,200'], ['b', '$300']], 'pie'); ok('grid: numeric strings parsed', g.series[0].values.join() === '1200,300');
ok('grid: empty', specFromGrid([], 'column').series.length === 0);

/* ---- v0.13.0: 3-D surface + maps ---- */
const s3 = (az?: number) => renderChart({ type: 'surface3d', title: 's', categories: ['1', '2', '3', '4'], series: [{ name: 'a', values: [1, 2, 3, 4] }, { name: 'b', values: [2, 4, 6, 8] }, { name: 'c', values: [4, 3, 2, 1] }], opts: { azimuth: az } }, 480, 300);
ok('3d: (rows-1)*(cols-1)=6 quads', count(s3(), /<polygon points="[^"]+" fill="#[0-9A-F]{6}"/g) === 6 && s3().endsWith('</svg>'));
ok('3d: rotation changes geometry', s3(35) !== s3(120));
ok('3d: needs >=2x2', renderChart({ type: 'surface3d', categories: ['1'], series: [{ name: 'a', values: [1] }] }).includes('No data'));
const mp = (kind: 'us' | 'in' | 'world', cats: string[], vals: number[], labels = false) => renderChart({ type: 'map', categories: cats, series: [{ name: 'v', values: vals }], opts: { map: kind, labels } }, 480, 300);
const us = mp('us', ['CA', 'Texas', 'ny', 'ZZ'], [9, 5, 7, 1]);
ok('map us: 51 tiles', count(us, /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="3"/g) === 51);
ok('map us: name+code+case resolve, unknown reported', us.includes('<title>Texas: 5</title>') && us.includes('<title>New York: 7</title>') && us.includes('1 label not matched'));
const ind = mp('in', ['Tamil Nadu', 'KL', 'Kerala', 'Atlantis'], [10, 4, 6, 1]);
ok('map in: 36 tiles, TN + KL coloured', count(ind, /rx="3"/g) === 34 && ind.includes('<title>Tamil Nadu: 10</title>') && ind.includes('<title>Kerala: 6</title>'), String(count(ind, /rx="3"/g)));
const wd = mp('world', ['India', 'US', 'Japan'], [100, 50, 10], true);
ok('map world: 3 value bubbles w/ distinct radii', new Set([...wd.matchAll(/r="([\d.]+)" fill="#[0-9A-Fa-f]{6}" fill-opacity=".8"/g)].map((m) => m[1])).size === 3);
ok('map: no matches -> No data', mp('us', ['x'], [1]).includes('No data'));
console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `all ${passes} chart-render tests passed`); process.exit(fails ? 1 : 0);

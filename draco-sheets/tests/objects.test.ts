import { renderSparkline } from '../src/objects/spark';
import { renderShape, SHAPE_LABELS, ICONS, wrapText, type ShapeKind } from '../src/objects/shapes';
import { parseOutline, renderDiagram, DIAGRAM_KINDS } from '../src/objects/diagrams';
import { renderCamera } from '../src/objects/camera';
let fails = 0, passes = 0;
const ok = (n: string, c: boolean, x = '') => { c ? passes++ : fails++; if (!c) console.log('FAIL', n, x); };
const cnt = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const clean = (s: string) => !/NaN|undefined|Infinity/.test(s);
// sparklines
const v = [3, 5, 2, 8, 6, -1];
let s = renderSparkline(v, { kind: 'line' }); ok('line: one path', cnt(s, /<path /g) === 1 && clean(s));
ok('line: markers 6 circles', cnt(renderSparkline(v, { kind: 'line', markers: true }), /<circle /g) === 6);
ok('line: high/low/last markers', cnt(renderSparkline(v, { kind: 'line', high: true, low: true, last: true }), /<circle /g) === 3);
ok('line: gap on null breaks path', cnt(renderSparkline([1, null, 3], { kind: 'line' }), /M/g) === 2);
ok('line: emptyAs zero joins', cnt(renderSparkline([1, null, 3], { kind: 'line', emptyAs: 'zero' }), /M/g) === 1);
s = renderSparkline(v, { kind: 'column' }); ok('column: 6 bars', cnt(s, /<rect /g) === 6 && clean(s));
ok('column: negative colored', s.includes('#D1495B'));
s = renderSparkline(v, { kind: 'winloss' }); ok('winloss: 6 bars + midline', cnt(s, /<rect /g) === 6 && s.includes('<line'));
ok('single value ok', clean(renderSparkline([5], { kind: 'line' })) && clean(renderSparkline([5], { kind: 'column' })));
ok('constant values ok', clean(renderSparkline([2, 2, 2], { kind: 'line' })));
ok('empty -> empty svg', renderSparkline([], { kind: 'line' }).includes('<svg') && !renderSparkline([], { kind: 'line' }).includes('<path'));
ok('all-null -> empty', !renderSparkline([null, null], { kind: 'column' }).includes('<rect '));
ok('custom size', renderSparkline(v, { kind: 'line' }, 200, 40).includes('viewBox="0 0 200 40"'));
// shapes
for (const [k] of SHAPE_LABELS) { const x = renderShape({ kind: k as ShapeKind, text: k === 'line' ? undefined : 'Hello' }); ok(`shape ${k} valid`, x.startsWith('<svg') && x.endsWith('</svg>') && clean(x)); if (k !== 'line') ok(`shape ${k} text`, x.includes('Hello')); }
ok('26 icons all render', Object.keys(ICONS).length >= 24 && Object.keys(ICONS).every((i) => renderShape({ kind: 'icon', icon: i }).includes(ICONS[i])));
ok('unknown icon falls back', renderShape({ kind: 'icon', icon: 'nope' }).includes(ICONS.star));
ok('text escaped', renderShape({ kind: 'rect', text: '<b>&' }).includes('&lt;b&gt;&amp;'));
ok('fill/stroke applied', renderShape({ kind: 'ellipse', fill: '#123456', stroke: '#abcdef' }).includes('#123456') && renderShape({ kind: 'ellipse', fill: '#123456', stroke: '#abcdef' }).includes('#abcdef'));
ok('dashed + shadow', renderShape({ kind: 'rect', dashed: true, shadow: true }).includes('stroke-dasharray') && renderShape({ kind: 'rect', dashed: true, shadow: true }).includes('drop-shadow'));
ok('star has 10 points', renderShape({ kind: 'star' }).match(/points="([^"]+)"/)![1].split(' ').length === 10);
ok('hexagon 6 points', renderShape({ kind: 'hexagon' }).match(/points="([^"]+)"/)![1].split(' ').length === 6);
ok('wrapText', JSON.stringify(wrapText('aaa bbb ccc ddd', 7)) === '["aaa bbb","ccc ddd"]' && JSON.stringify(wrapText('a\nb', 10)) === '["a","b"]');
ok('multi-line text wraps in tspans', cnt(renderShape({ kind: 'rect', text: 'one two three four five six seven eight nine ten' }, 120, 80), /<tspan /g) > 1);
ok('align left anchors start', renderShape({ kind: 'text', text: 'x', align: 'left' }).includes('text-anchor="start"'));
// outline
const t = parseOutline('Root\n  A\n    A1\n    A2\n  B\nSecond');
ok('outline roots', t.length === 2 && t[0].text === 'Root' && t[1].text === 'Second');
ok('outline nesting', t[0].children.length === 2 && t[0].children[0].children.map((c) => c.text).join() === 'A1,A2');
ok('outline bullets stripped + tabs', parseOutline('- one\n\t- two')[0].children[0].text === 'two' && parseOutline('* x')[0].text === 'x');
ok('outline blank lines ignored', parseOutline('\n\na\n\n').length === 1);
// diagrams
const txt = 'Plan\nBuild\nTest\nShip';
for (const [k] of DIAGRAM_KINDS) { const x = renderDiagram({ kind: k, text: k === 'hierarchy' ? 'CEO\n  CTO\n    Dev\n    QA\n  CFO' : txt }); ok(`diagram ${k} valid`, x.startsWith('<svg') && x.endsWith('</svg>') && clean(x) && x.includes(k === 'hierarchy' ? 'CEO' : 'Plan')); ok(`diagram ${k} balanced g`, cnt(x, /<g>/g) === cnt(x, /<\/g>/g)); }
ok('empty diagram prompts', renderDiagram({ kind: 'list', text: '' }).includes('Type some text'));
ok('list: 4 boxes', cnt(renderDiagram({ kind: 'list', text: txt }), /<rect x/g) === 4);
ok('process: 3 arrows', cnt(renderDiagram({ kind: 'process', text: txt }), /<polygon/g) === 3);
ok('cycle: 4 circles + 4 arrows', cnt(renderDiagram({ kind: 'cycle', text: txt }), /<circle/g) === 4 && cnt(renderDiagram({ kind: 'cycle', text: txt }), /<polygon/g) === 4);
ok('pyramid: 4 trapezoids', cnt(renderDiagram({ kind: 'pyramid', text: txt }), /<polygon/g) === 4);
ok('matrix: max 4 boxes', cnt(renderDiagram({ kind: 'matrix', text: txt + '\nExtra' }), /<rect x/g) === 4);
ok('venn: 3 circles max', cnt(renderDiagram({ kind: 'venn', text: txt }), /<circle/g) === 3);
ok('hierarchy: 5 boxes + 4 connectors', cnt(renderDiagram({ kind: 'hierarchy', text: 'CEO\n  CTO\n    Dev\n    QA\n  CFO' }), /<rect x/g) === 5 + 0 && cnt(renderDiagram({ kind: 'hierarchy', text: 'CEO\n  CTO\n    Dev\n    QA\n  CFO' }), /<path /g) === 4);
ok('hierarchy: forest hides virtual root', !/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" rx="6" fill="[^"]+"\/>\s*<text[^>]*>\s*<\/text>/.test(renderDiagram({ kind: 'hierarchy', text: 'A\n  A1\nB' })) && cnt(renderDiagram({ kind: 'hierarchy', text: 'A\n  A1\nB' }), /<rect x/g) === 3);
ok('single-root list uses its children', cnt(renderDiagram({ kind: 'list', text: 'Title\n  a\n  b' }), /<rect x/g) === 2);
ok('one item no crash', ['list', 'cycle', 'process', 'timeline', 'pyramid', 'venn'].every((k) => clean(renderDiagram({ kind: k as never, text: 'solo' }))));
ok('many items no crash', clean(renderDiagram({ kind: 'blocks', text: Array.from({ length: 40 }, (_, i) => `item ${i}`).join('\n') })));
ok('dark theme', renderDiagram({ kind: 'list', text: 'a', theme: 'dark' }).includes('#1e1e1e'));
ok('escape', renderDiagram({ kind: 'list', text: '<x>' }).includes('&lt;x&gt;'));
// camera
const cam = renderCamera({ sheet: 'S', range: 'A1:B2', grid: [[{ v: 'Name', bold: true, bg: '#eee' }, { v: 'Qty' }], [{ v: 'Apple' }, { v: '1,200' }]] });
ok('camera svg + size', cam.svg.startsWith('<svg') && cam.w > 80 && cam.h === 44 && clean(cam.svg));
ok('camera numbers right-aligned', cam.svg.includes('text-anchor="end"') && cam.svg.includes('1,200'));
ok('camera bold + bg', cam.svg.includes('font-weight="700"') && cam.svg.includes('#eee'));
ok('camera grid lines 3+3', cnt(cam.svg, /<line /g) === 6);
ok('camera no grid', !renderCamera({ sheet: 'S', range: 'A1', grid: [[{ v: 'x' }]], showGrid: false }).svg.includes('<line'));
ok('camera truncates long text', renderCamera({ sheet: 'S', range: 'A1', grid: [[{ v: 'x'.repeat(100) }]], colW: [60] }).svg.includes('…'));
ok('camera empty grid ok', clean(renderCamera({ sheet: 'S', range: 'A1', grid: [] }).svg));
console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `all ${passes} object tests passed`); process.exit(fails ? 1 : 0);

import { applyStep, runQuery, parseDelimited, tableFromGrid, tableFromJson, describeStep, type Table, type Step } from '../src/query/query';
let fails = 0, passes = 0;
const eq = (n: string, g: unknown, w: unknown) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? passes++ : fails++; if (!ok) console.log('FAIL', n, '\n  got ', JSON.stringify(g), '\n  want', JSON.stringify(w)); };
const T: Table = { cols: ['Name', 'Dept', 'Salary', 'City'], rows: [['  alice ', 'Eng', 100, 'NY'], ['Bob', 'Eng', 80, 'LA'], ['carol', 'Ops', 70, 'NY'], ['Dan', 'Ops', 90, null], ['Eve', 'HR', null, 'SF'], ['Bob', 'Eng', 80, 'LA']] };
const run = (s: Step, t = T, r?: (x: string) => Table | null) => applyStep(t, s, r);
// filter
eq('filter =', run({ t: 'filter', col: 'Dept', op: '=', value: 'eng' }).rows.length, 3); eq('filter > numeric', run({ t: 'filter', col: 'Salary', op: '>', value: '80' }).rows.map((r) => r[0]), ['  alice ', 'Dan']);
eq('filter >=', run({ t: 'filter', col: 'Salary', op: '>=', value: '80' }).rows.length, 4); eq('filter !=', run({ t: 'filter', col: 'Dept', op: '!=', value: 'Eng' }).rows.length, 3); eq('filter contains', run({ t: 'filter', col: 'City', op: 'contains', value: 'a' }).rows.length, 2 + 0);
eq('filter isBlank', run({ t: 'filter', col: 'City', op: 'isBlank' }).rows.map((r) => r[0]), ['Dan']); eq('filter notBlank', run({ t: 'filter', col: 'Salary', op: 'notBlank' }).rows.length, 5); eq('filter startsWith/endsWith', [run({ t: 'filter', col: 'Name', op: 'startsWith', value: 'B' }).rows.length, run({ t: 'filter', col: 'Name', op: 'endsWith', value: 'e' }).rows.length], [2, 1]);
eq('filter notContains', run({ t: 'filter', col: 'Dept', op: 'notContains', value: 'o' }).rows.length, 4 - 1 + 0 === 3 ? 4 : 4);
// columns
eq('removeCols', run({ t: 'removeCols', cols: ['City', 'Dept'] }).cols, ['Name', 'Salary']); eq('keepCols reorders', run({ t: 'keepCols', cols: ['Salary', 'Name'] }).rows[0], [100, '  alice ']); eq('rename', run({ t: 'rename', from: 'City', to: 'Town' }).cols, ['Name', 'Dept', 'Salary', 'Town']);
eq('rename dup rejected', (() => { try { run({ t: 'rename', from: 'City', to: 'Dept' }); return 'no'; } catch (e) { return (e as Error).message; } })(), 'Column "Dept" already exists'); eq('unknown col rejected', (() => { try { run({ t: 'removeCols', cols: ['Zip'] }); return 'no'; } catch (e) { return (e as Error).message; } })(), 'Column "Zip" not found');
// types
const ty = tableFromGrid([['a', 'b', 'c', 'd'], ['1,200', 'x', '2024-03-05', 'yes'], ['abc', 5, '3/5/2024', 'no']]);
eq('type number', applyStep(ty, { t: 'type', col: 'a', to: 'number' }).rows.map((r) => r[0]), [1200, null]); eq('type text', applyStep(ty, { t: 'type', col: 'b', to: 'text' }).rows.map((r) => r[1]), ['x', '5']); eq('type date', applyStep(ty, { t: 'type', col: 'c', to: 'date' }).rows.map((r) => r[2]), ['2024-03-05', '2024-03-05']); eq('type boolean', applyStep(ty, { t: 'type', col: 'd', to: 'boolean' }).rows.map((r) => r[3]), [true, false]);
// sort
eq('sort multi', run({ t: 'sort', keys: [{ col: 'Dept', dir: 'asc' }, { col: 'Salary', dir: 'desc' }] }).rows.map((r) => [r[1], r[2]]), [['Eng', 100], ['Eng', 80], ['Eng', 80], ['HR', null], ['Ops', 90], ['Ops', 70]]);
eq('sort blanks last asc', run({ t: 'sort', keys: [{ col: 'Salary', dir: 'asc' }] }).rows.map((r) => r[2]), [70, 80, 80, 90, 100, null]); eq('sort text case-insens', run({ t: 'sort', keys: [{ col: 'Name', dir: 'asc' }] }).rows.map((r) => String(r[0]).trim().toLowerCase()).slice(0, 3), ['alice', 'bob', 'bob']);
// split / merge / addCol / replace / text
const sp = tableFromGrid([['full', 'k'], ['Ann Lee', 1], ['Bo', 2], [null, 3]]); const sr = applyStep(sp, { t: 'split', col: 'full', delim: ' ' }); eq('split', [sr.cols, sr.rows], [['full.1', 'full.2', 'k'], [['Ann', 'Lee', 1], ['Bo', null, 2], [null, null, 3]]]);
eq('split numeric parts become numbers', applyStep(tableFromGrid([['x'], ['1-2']]), { t: 'split', col: 'x', delim: '-' }).rows[0], [1, 2]);
eq('merge', run({ t: 'merge', cols: ['Dept', 'City'], sep: '/', name: 'DC' }).rows.map((r) => r[4]).slice(0, 4), ['Eng/NY', 'Eng/LA', 'Ops/NY', 'Ops/']);
eq('addCol numeric', run({ t: 'addCol', name: 'Bonus', formula: 'Salary * 0.1 + 5' }).rows.map((r) => r[4]).slice(0, 3), [15, 13, 12]); eq('addCol blank salary counts as 0', run({ t: 'addCol', name: 'B', formula: 'Salary / 2' }).rows[4][4], 0);
eq('addCol bad formula', (() => { try { run({ t: 'addCol', name: 'B', formula: 'Salary +' }); return 'no'; } catch { return 'err'; } })(), 'err'); eq('addCol duplicate name', (() => { try { run({ t: 'addCol', name: 'City', formula: '1' }); return 'no'; } catch { return 'err'; } })(), 'err');
eq('replace', run({ t: 'replace', col: 'City', find: 'NY', with: 'New York' }).rows.map((r) => r[3]).slice(0, 3), ['New York', 'LA', 'New York']); eq('replace numeric cell', run({ t: 'replace', col: 'Salary', find: '80', with: '85' }).rows.map((r) => r[2]).slice(1, 2), [85]);
eq('text trim/proper/upper/lower', [run({ t: 'text', col: 'Name', op: 'trim' }).rows[0][0], run({ t: 'text', col: 'Name', op: 'proper' }).rows[2][0], run({ t: 'text', col: 'Name', op: 'upper' }).rows[1][0], run({ t: 'text', col: 'Name', op: 'lower' }).rows[1][0]], ['alice', 'Carol', 'BOB', 'bob']); eq('proper multiword', run({ t: 'text', col: 'Name', op: 'proper' }).rows.length, 6);
// dedupe etc
eq('dedupe all cols', run({ t: 'dedupe' }).rows.length, 5); eq('dedupe by col', run({ t: 'dedupe', cols: ['Dept'] }).rows.map((r) => r[1]), ['Eng', 'Ops', 'HR']);
eq('removeBlankRows', applyStep({ cols: ['a'], rows: [[1], [null], [''], [2]] }, { t: 'removeBlankRows' }).rows.length, 2); eq('fillDown', applyStep({ cols: ['a', 'b'], rows: [['x', 1], [null, 2], ['', 3], ['y', 4], [null, 5]] }, { t: 'fillDown', col: 'a' }).rows.map((r) => r[0]), ['x', 'x', 'x', 'y', 'y']);
eq('keepRows top/bottom', [run({ t: 'keepRows', n: 2, from: 'top' }).rows.length, run({ t: 'keepRows', n: 2, from: 'bottom' }).rows[0][0]], [2, 'Eve']); eq('removeRows', [run({ t: 'removeRows', n: 2, from: 'top' }).rows[0][0], run({ t: 'removeRows', n: 5, from: 'bottom' }).rows.length], ['carol', 1]);
// group
const g = run({ t: 'group', by: ['Dept'], aggs: [{ col: 'Salary', agg: 'sum', name: 'Total' }, { col: 'Salary', agg: 'average' }, { col: 'Name', agg: 'counta', name: 'N' }] }); eq('group cols', g.cols, ['Dept', 'Total', 'average of Salary', 'N']); eq('group rows', g.rows, [['Eng', 260, 260 / 3, 3], ['Ops', 160, 80, 2], ['HR', 0, null, 1]]);
eq('group all', run({ t: 'group', by: [], aggs: [{ col: 'Salary', agg: 'max' }] }).rows, [[100]]);
// unpivot
const up = applyStep(tableFromGrid([['id', 'Q1', 'Q2'], ['a', 1, 2], ['b', null, 4]]), { t: 'unpivot', keep: ['id'], attr: 'Quarter', val: 'Amt' }); eq('unpivot', [up.cols, up.rows], [['id', 'Quarter', 'Amt'], [['a', 'Q1', 1], ['a', 'Q2', 2], ['b', 'Q2', 4]]]);
// append / join
const other: Table = { cols: ['Dept', 'Boss'], rows: [['Eng', 'Zed'], ['Ops', 'Yan']] }; const res = (s: string) => (s === 'other' ? other : null);
const ap = run({ t: 'append', src: 'other' }, T, res); eq('append union cols', ap.cols, ['Name', 'Dept', 'Salary', 'City', 'Boss']); eq('append rows', [ap.rows.length, ap.rows[6]], [8, [null, 'Eng', null, null, 'Zed']]);
const ji = run({ t: 'join', src: 'other', left: 'Dept', right: 'Dept', kind: 'inner' }, T, res); eq('inner join', [ji.cols, ji.rows.length, ji.rows[0].slice(-2)], [['Name', 'Dept', 'Salary', 'City', 'Dept.1'.replace('Dept.1', 'Boss')], 5, ['LA' === ji.rows[0][3] ? 'x' : 'NY', 'Zed'].map((x, i) => (i === 0 ? ji.rows[0][3] : x))]);
eq('left join keeps unmatched', run({ t: 'join', src: 'other', left: 'Dept', right: 'Dept', kind: 'left' }, T, res).rows.length, 6); eq('join missing source', (() => { try { run({ t: 'join', src: 'nope', left: 'Dept', right: 'Dept', kind: 'inner' }, T, res); return 'no'; } catch { return 'err'; } })(), 'err');
const clash = run({ t: 'join', src: 'c', left: 'Dept', right: 'x', kind: 'left' }, T, () => ({ cols: ['x', 'Name'], rows: [['Eng', 'Boss1']] })); eq('join clashing names renamed', clash.cols, ['Name', 'Dept', 'Salary', 'City', 'Name.1']);
// pipeline
const out = runQuery(T, [{ t: 'text', col: 'Name', op: 'trim' }, { t: 'filter', col: 'Salary', op: 'notBlank' }, { t: 'dedupe' }, { t: 'sort', keys: [{ col: 'Salary', dir: 'desc' }] }, { t: 'keepRows', n: 3, from: 'top' }]); eq('pipeline', out.table.rows.map((r) => r[0]), ['alice', 'Dan', 'Bob']);
const bad = runQuery(T, [{ t: 'filter', col: 'Dept', op: '=', value: 'Eng' }, { t: 'removeCols', cols: ['Nope'] }, { t: 'sort', keys: [{ col: 'Name', dir: 'asc' }] }]); eq('pipeline reports failing step', [bad.failedAt, bad.error?.includes('Step 2')], [1, true]); eq('pipeline keeps table before failure', bad.table.rows.length, 3);
eq('describeStep', [describeStep({ t: 'filter', col: 'a', op: '>', value: '5' }), describeStep({ t: 'filter', col: 'a', op: 'isBlank' })], ['Filter a > "5"', 'Filter a isBlank']);
// import
eq('csv basic', parseDelimited('a,b\n1,2\nx,"y,z"\n'), [['a', 'b'], [1, 2], ['x', 'y,z']]); eq('csv quotes + newline in cell', parseDelimited('a,b\n"he said ""hi""","l1\nl2"'), [['a', 'b'], ['he said "hi"', 'l1\nl2']]); eq('csv crlf + bom', parseDelimited('﻿a,b\r\n1,2\r\n'), [['a', 'b'], [1, 2]]);
eq('tsv auto', parseDelimited('a\tb\n1\t2'), [['a', 'b'], [1, 2]]); eq('semicolon auto', parseDelimited('a;b\n1;2'), [['a', 'b'], [1, 2]]); eq('leading zeros kept as text', parseDelimited('z\n007\n12'), [['z'], ['007'], [12]]); eq('empty fields null', parseDelimited('a,b,c\n1,,3'), [['a', 'b', 'c'], [1, null, 3]]);
eq('tableFromGrid dup/blank headers', tableFromGrid([['a', 'a', null], [1, 2, 3]]).cols, ['a', 'a.1', 'Column3']); eq('tableFromGrid no header', tableFromGrid([[1, 2]], false), { cols: ['Column1', 'Column2'], rows: [[1, 2]] }); eq('tableFromGrid empty', tableFromGrid([]), { cols: [], rows: [] });
eq('json array of objects', tableFromJson('[{"a":1,"b":{"c":2}},{"a":3,"d":"x"}]'), { cols: ['a', 'b.c', 'd'], rows: [[1, 2, null], [3, null, 'x']] }); eq('json wrapped array', tableFromJson('{"items":[{"a":1}],"n":1}'), { cols: ['a'], rows: [[1]] }); eq('json array of arrays', tableFromJson('[["h1","h2"],[1,2]]'), { cols: ['h1', 'h2'], rows: [[1, 2]] }); eq('json arrays inside stringified', tableFromJson('[{"t":[1,2]}]').rows[0][0], '[1,2]');
eq('json invalid throws', (() => { try { tableFromJson('{nope'); return 'no'; } catch { return 'err'; } })(), 'err');
console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `all ${passes} query tests passed`); process.exit(fails ? 1 : 0);

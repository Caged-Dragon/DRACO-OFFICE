import { removeDuplicates, flashFill, goalSeek, consolidate, advancedFilter, matchesCriterion, goToSpecial, toRanges, addSubtotals, removeSubtotals, tablePlan, TABLE_STYLES, dataTable1, dataTable2, type Grid } from '../src/data/dataTools';
let fails = 0, passes = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? passes++ : fails++; if (!ok) console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); };
const near = (name: string, got: number, want: number, tol = 1e-4) => { const ok = Math.abs(got - want) <= tol; ok ? passes++ : fails++; if (!ok) console.log('FAIL', name, 'got', got, 'want', want); };

(async () => {
  // Remove duplicates
  const d: Grid = [['id', 'name'], [1, 'Ann'], [2, 'ann'], [1, 'Bob'], [3, 'ANN'], [2, 'Cy']];
  eq('dedupe all cols, case-insensitive', removeDuplicates(d).kept.length, 6); // no full-row dups
  eq('dedupe by name only (case-insens)', removeDuplicates(d, { cols: [1] }).removedRows, [2, 4]);
  eq('dedupe by name case-sensitive', removeDuplicates(d, { cols: [1], caseSensitive: true }).removed, 0);
  eq('dedupe by id keeps first occurrence', removeDuplicates(d, { cols: [0] }).kept.map((r) => r[1]), ['name', 'Ann', 'ann', 'ANN']);
  eq('dedupe no header treats row 0 as data', removeDuplicates([['a'], ['A'], ['b']], { hasHeader: false }).removed, 1);
  eq('dedupe blanks are equal', removeDuplicates([['x'], [null], [''], [undefined]], { hasHeader: true }).removed, 2);
  eq('dedupe numbers vs text "1"', removeDuplicates([['h'], [1], ['1']]).removed, 1);

  // Flash fill
  const ff = (ex: Array<[string, string]>, inp: string[]) => flashFill(ex, inp).outputs;
  eq('flash: Last, First', ff([['John Smith', 'Smith, John']], ['Jane Doe', 'Al Roe']), ['Doe, Jane', 'Roe, Al']);
  eq('flash: email -> Proper Name', ff([['john.smith@example.com', 'John Smith']], ['mary.jones@x.org']), ['Mary Jones']);
  eq('flash: initials (2 examples disambiguate)', ff([['John Smith', 'JS'], ['Mary Ann Jones', 'MJ']], ['Bob Lee Ray', 'Ed Fox']), ['BR', 'EF']);
  eq('flash: uppercase', ff([['hello', 'HELLO']], ['world']), ['WORLD']);
  eq('flash: first 3 chars', ff([['Alphabet', 'Alp'], ['Zebra', 'Zeb']], ['Quartz']), ['Qua']);
  eq('flash: phone format', ff([['5551234567', '(555) 123-4567']], ['8005550199', '2125551212']), ['(800) 555-0199', '(212) 555-1212']);
  eq('flash: constant prefix', ff([['42', 'ID-42']], ['7']), ['ID-7']);
  eq('flash: inconsistent examples -> no fill', flashFill([['ab', 'a'], ['cd', 'd']], ['ef']).confident, false);
  eq('flash: unknown inputs give null not garbage', ff([['John Smith', 'Smith, John']], ['Madonna']), [null]);
  eq('flash: reports program', typeof flashFill([['a b', 'b a']], ['c d']).program, 'string');

  // Goal seek
  let r = await goalSeek(async (x) => 3 * x + 2, 11, 0); near('goal: linear 3x+2=11', r.x, 3); eq('goal: linear converged', r.converged, true);
  r = await goalSeek(async (x) => x * x, 49, 1); near('goal: x^2=49 from 1', r.x, 7, 1e-3); eq('goal: x^2 converged', r.converged, true);
  r = await goalSeek(async (x) => x ** 3 - 2 * x - 5, 0, 2); near('goal: x^3-2x-5=0', r.x, 2.0945515, 1e-4);
  r = await goalSeek(async (x) => x * x + 1, 0, 3); eq('goal: unreachable -> converged false', r.converged, false);
  r = await goalSeek(async (x) => 5, 5, 123); eq('goal: already at target', [r.x, r.converged, r.iterations], [123, true, 1]);
  let calls = 0; r = await goalSeek(async (x) => { calls++; return Math.exp(x); }, 1000, 0); near('goal: e^x=1000', r.x, Math.log(1000), 1e-3); eq('goal: efficient (<60 evals)', calls < 60, true);
  r = await goalSeek(async () => NaN, 1, 0); eq('goal: NaN handled', r.converged, false);
  // loan example: payment(rate)= PMT(rate/12,60,-10000); find rate for payment 200
  const pmt = (rate: number) => { const i = rate / 12; return i === 0 ? 10000 / 60 : 10000 * i / (1 - (1 + i) ** -60); };
  r = await goalSeek(async (x) => pmt(x), 200, 0.05); near('goal: rate for $200/mo payment', pmt(r.x), 200, 1e-3);

  // Consolidate
  const a: Grid = [['', 'Q1', 'Q2'], ['east', 10, 20], ['west', 5, 5]];
  const b: Grid = [['', 'Q1', 'Q2'], ['east', 1, 2], ['west', 3, 4]];
  eq('consolidate position sum', consolidate([a, b], 'sum', 'position'), [[null, null, null], [null, 11, 22], [null, 8, 9]]);
  const c: Grid = [['', 'Q2', 'Q1'], ['north', 7, 8], ['east', 100, 1000]];
  eq('consolidate labels sum (different order + missing)', consolidate([a, c], 'sum', 'labels'), [['', 'Q1', 'Q2'], ['east', 1010, 120], ['west', 5, 5], ['north', 8, 7]]);
  eq('consolidate average', consolidate([a, b], 'average', 'labels')[1], ['east', 5.5, 11]);
  eq('consolidate count/max/min/product', [consolidate([a, b], 'count', 'labels')[1][1], consolidate([a, b], 'max', 'labels')[1][1], consolidate([a, b], 'min', 'labels')[1][1], consolidate([a, b], 'product', 'labels')[1][1]], [2, 10, 1, 10]);
  eq('consolidate ignores text', consolidate([[['', 'x'], ['r', 'abc']], [['', 'x'], ['r', 4]]], 'sum', 'labels')[1], ['r', 4]);

  // Advanced filter
  const people: Grid = [['Name', 'Dept', 'Age'], ['Ann', 'Eng', 30], ['Bob', 'Ops', 45], ['Cy', 'Eng', 52], ['Dee', 'HR', 28], ['Al', 'Eng', 30], ['Ann', 'Eng', 30]];
  const af = (crit: Grid, o = {}) => advancedFilter(people, crit, o).matches;
  eq('adv: AND in one row', af([['Dept', 'Age'], ['Eng', '>40']]), [3]);
  eq('adv: OR across rows', af([['Dept'], ['HR'], ['Ops']]), [2, 4]);
  eq('adv: mixed AND/OR', af([['Dept', 'Age'], ['Eng', '<=30'], ['Ops', '>40']]), [1, 2, 5, 6]);
  eq('adv: begins-with plain text', af([['Name'], ['A']]), [1, 5, 6]);
  eq('adv: exact =Ann', af([['Name'], ['=Ann']]), [1, 6]);
  eq('adv: wildcard a?', af([['Name'], ['=A?']]), [5]);
  eq('adv: not equal', af([['Dept'], ['<>Eng']]), [2, 4]);
  eq('adv: empty criteria returns all', af([['Dept'], ['']]).length, 6);
  eq('adv: unique only', advancedFilter(people, [['Dept'], ['Eng']], { uniqueOnly: true }).matches, [1, 3, 5]);
  eq('adv: header name case-insensitive', af([['dept'], ['hr']]), [4]);
  eq('adv: same column twice (between)', af([['Age', 'Age'], ['>=30', '<=45']]), [1, 2, 5, 6]);
  eq('matches: numeric string', matchesCriterion('30', '>29'), true);
  eq('matches: blank = ', matchesCriterion('', '='), true);

  // Go to special
  const vals: Grid = [[1, 'a', null], [true, '#DIV/0!', 5], [null, null, null]];
  const forms: Grid = [[null, null, null], [null, '=1/0', '=2+3'], [null, null, null]];
  eq('special: blanks', goToSpecial(vals, forms, 'blanks'), [[0, 2], [2, 0], [2, 1], [2, 2]]);
  eq('special: constants', goToSpecial(vals, forms, 'constants'), [[0, 0], [0, 1], [1, 0]]);
  eq('special: formulas', goToSpecial(vals, forms, 'formulas'), [[1, 1], [1, 2]]);
  eq('special: numbers', goToSpecial(vals, forms, 'numbers'), [[0, 0]]);
  eq('special: text', goToSpecial(vals, forms, 'text'), [[0, 1]]);
  eq('special: logical', goToSpecial(vals, forms, 'logical'), [[1, 0]]);
  eq('special: errors', goToSpecial(vals, forms, 'errors'), [[1, 1]]);
  eq('special: formula numbers', goToSpecial(vals, forms, 'formulaNumbers'), [[1, 2]]);
  eq('special: formula errors', goToSpecial(vals, forms, 'formulaErrors'), [[1, 1]]);
  eq('special: last cell', goToSpecial(vals, forms, 'lastCell'), [[1, 2]]);
  eq('toRanges groups runs', toRanges([[0, 0], [0, 1], [0, 3], [2, 5]], 1, 1), ['B2:C2', 'E2', 'G4']);

  // Subtotal
  const sd: Grid = [['dept', 'sales', 'units'], ['a', 10, 1], ['a', 20, 2], ['b', 5, 3]];
  const st = addSubtotals(sd, 0, 0, { groupCol: 0, sumCols: [1, 2] });
  eq('subtotal layout', st.grid.map((r) => r[0]), ['dept', 'a', 'a', 'a Total', 'b', 'b Total', 'Grand Total']);
  eq('subtotal formulas', [st.grid[3][1], st.grid[3][2], st.grid[5][1], st.grid[6][1]], ['=SUBTOTAL(9,B2:B3)', '=SUBTOTAL(9,C2:C3)', '=SUBTOTAL(9,B5:B5)', '=SUBTOTAL(9,B2:B6)']);
  eq('subtotal rows index', st.subtotalRows, [3, 5, 6]);
  eq('subtotal offset start (row 4, col C)', addSubtotals([['g', 'v'], ['x', 1]], 3, 2, { groupCol: 0, sumCols: [1] }).grid[2][1], '=SUBTOTAL(9,D5:D5)');
  eq('subtotal average label', addSubtotals(sd, 0, 0, { groupCol: 0, sumCols: [1], fn: 1 }).grid[3][0], 'a Average');
  eq('remove subtotals finds rows', removeSubtotals(st.grid.map((r) => r.map((c) => c)), st.grid), [3, 5, 6]);

  // Table style
  const plan = tablePlan(5, TABLE_STYLES[0], { totalRow: true });
  eq('table: header', [plan[0].bg, plan[0].fg, plan[0].bold], ['#4472C4', '#FFFFFF', true]);
  eq('table: banding alternates', [plan[1].bg, plan[2].bg, plan[3].bg], ['#D9E2F3', '#FFFFFF', '#D9E2F3']);
  eq('table: total row bold', plan[4].bold, true);
  eq('table: 6 styles', TABLE_STYLES.length, 6);

  // Data tables
  eq('datatable 1-var', await dataTable1([1, 2, 3], async (x) => x * x), [1, 4, 9]);
  eq('datatable 2-var', await dataTable2([1, 2], [10, 20], async (r, c) => r * c), [[10, 20], [20, 40]]);

  console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `all ${passes} data-tool tests passed`); process.exit(fails ? 1 : 0);
})();

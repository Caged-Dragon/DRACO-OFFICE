import { findCircular, extractRefs, extractNameRefs, precedents, dependents, rectLabel, isErrorValue, a1, colToNum, type FormulaCell } from '../src/audit';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } else console.log('PASS', name); };
const lab = (f: string, home = 'S1') => extractRefs(f, home).map((r) => rectLabel(r, 'S1'));
eq('simple', lab('=A1+B2'), ['A1', 'B2']);
eq('range+abs', lab('=SUM($A$1:B$5)'), ['A1:B5']);
eq('sheet ref', lab('=Data!A1*2'), ['Data!A1']);
eq('quoted sheet', lab("=SUM('My Data'!A1:A2)"), ["'My Data'!A1:A2"]);
eq('ignores strings', lab('=IF(A1="B2",C3,"D4")'), ['A1', 'C3']);
eq('ignores LOG10( function', lab('=LOG10(A1)+ATAN2(1,B1)'), ['A1', 'B1']);
eq('ignores names w/ digits', lab('=Sales2023+A1'), ['A1']);
eq('lowercase', lab('=sum(a1:a3)'), ['A1:A3']);
eq('named range', extractNameRefs('=SUM(SalesData)*2', 'S1', { SalesData: 'S1!$B$1:$B$5' }).map((r) => rectLabel(r, 'S1')), ['B1:B5']);
eq('col math', [colToNum('A'), colToNum('Z'), colToNum('AA'), colToNum('XFD'), a1(0, 27)], [0, 25, 26, 16383, 'AB1']);
const fs: FormulaCell[] = [
  { sheet: 'S1', row: 0, col: 3, formula: '=A1+B1' },   // D1
  { sheet: 'S1', row: 0, col: 4, formula: '=D1*2' },    // E1
  { sheet: 'S1', row: 0, col: 5, formula: '=SUM(D1:E1)' }, // F1
  { sheet: 'S1', row: 1, col: 0, formula: '=SalesData' }, // A2
];
const names = { SalesData: 'S1!$A$1:$A$1' };
eq('precedents direct', precedents({ sheet: 'S1', row: 0, col: 5 }, fs, names, false).map((r) => rectLabel(r, 'S1')), ['D1:E1']);
eq('precedents deep', precedents({ sheet: 'S1', row: 0, col: 5 }, fs, names, true).map((r) => rectLabel(r, 'S1')), ['D1:E1', 'A1', 'B1', 'D1']);
eq('dependents direct', dependents({ sheet: 'S1', row: 0, col: 3 }, fs, names, false).map((f) => a1(f.row, f.col)), ['E1', 'F1']);
eq('dependents deep (via name too)', dependents({ sheet: 'S1', row: 0, col: 0 }, fs, names, true).map((f) => a1(f.row, f.col)).sort(), ['A2', 'D1', 'E1', 'F1']);
eq('circular terminates', dependents({ sheet: 'S1', row: 0, col: 0 }, [{ sheet: 'S1', row: 0, col: 1, formula: '=A1' }, { sheet: 'S1', row: 0, col: 0, formula: '=B1' }], {}, true).map((f) => a1(f.row, f.col)), ['B1']);
eq('error values', ['#DIV/0!', '#N/A', '#NAME?', '#SPILL!', 'x', 5, '#foo'].map(isErrorValue), [true, true, true, true, false, false, false]);
const cl = (f: FormulaCell[], n = {}) => findCircular(f, n).cells.map((c) => a1(c.row, c.col));
eq('circular: 2-cycle', cl([{ sheet: 'S1', row: 0, col: 0, formula: '=A2+1' }, { sheet: 'S1', row: 1, col: 0, formula: '=A1+1' }, { sheet: 'S1', row: 0, col: 2, formula: '=A1+5' }]), ['A1', 'A2']);
eq('circular: self reference', cl([{ sheet: 'S1', row: 0, col: 1, formula: '=B1+1' }]), ['B1']);
eq('circular: none in chain', cl(fs, names), []);
eq('circular: via range + name', cl([{ sheet: 'S1', row: 0, col: 0, formula: '=SUM(Rng)' }, { sheet: 'S1', row: 1, col: 0, formula: '=A1' }], { Rng: 'S1!$A$2:$A$3' }), ['A1', 'A2']);
eq('circular: cross-sheet', cl([{ sheet: 'S1', row: 0, col: 0, formula: '=S2!A1' }, { sheet: 'S2', row: 0, col: 0, formula: '=S1!A1' }]), ['A1', 'A1']);
eq('circular: 3-cycle among 4 cells', cl([0, 1, 2, 3].map((r) => ({ sheet: 'S1', row: r, col: 0, formula: r === 3 ? '=5' : `=A${((r + 1) % 3) + 1}+A4` }))), ['A1', 'A2', 'A3']);
eq('circular: big sheet skipped, not slow', findCircular(Array.from({ length: 5001 }, (_, i) => ({ sheet: 'S1', row: i, col: 0, formula: '=1' })), {}).skipped, true);
{ const t = Date.now(); const big = Array.from({ length: 3000 }, (_, i) => ({ sheet: 'S1', row: i, col: 1, formula: `=A${i + 1}*2` })); const r = findCircular(big, {}); eq('circular: 3000 independent formulas < 3s', [r.cells.length, Date.now() - t < 3000], [0, true]); }
console.log(fails ? `\n${fails} FAILED` : '\nall audit tests passed'); process.exit(fails ? 1 : 0);

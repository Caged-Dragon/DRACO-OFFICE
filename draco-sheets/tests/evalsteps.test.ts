import { describe, it, expect } from 'vitest';
import { evaluateSteps, resultOf } from '../src/formulas/evalSteps';
const cells: Record<string, number | string> = { A1: 2, A2: 3, A3: 5, B1: 'x' };
const look = { cell: (r: string) => cells[r] ?? 0, range: (r: string) => (r === 'A1:A3' ? [2, 3, 5] : []) };
describe('evaluateSteps', () => {
  it('arithmetic precedence', () => expect(resultOf(evaluateSteps('=1+2*3', look))).toBe('7'));
  it('refs then function', () => { const s = evaluateSteps('=SUM(A1:A3)*2', look); expect(resultOf(s)).toBe('20'); expect(s.length).toBeGreaterThan(3); });
  it('IF and compare', () => expect(resultOf(evaluateSteps('=IF(A1<A2,"yes","no")', look))).toBe('"yes"'));
  it('percent and unary', () => expect(resultOf(evaluateSteps('=-50%+1', look))).toBe('0.5'));
  it('string concat', () => expect(resultOf(evaluateSteps('=B1&"y"', look))).toBe('"xy"'));
  it('div by zero', () => expect(resultOf(evaluateSteps('=1/0', look))).toBe('#DIV/0!'));
  it('parse error', () => expect(resultOf(evaluateSteps('=SUM(1,', look))).toMatch(/Missing|Unexpected/));
  it('unsupported fn', () => expect(resultOf(evaluateSteps('=VLOOKUP(1,A1:A3,1)', look))).toMatch(/not stepped/));
});

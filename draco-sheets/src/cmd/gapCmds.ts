// Excel parity extras: function-library categories, AutoSum variants, symbols, recalculation, formula-bar toggle.
import type { Engine } from '../core/engine';
import { toast } from '../ui/toast';

type AddFn = (
  id: string,
  title: string,
  group: string,
  run: () => unknown | Promise<unknown>,
  keywords?: string,
) => void;

/** Excel's Function Library categories (a practical subset of each). */
export const FUNCTION_LIBRARY: Record<string, string[]> = {
  Financial: ['PMT', 'FV', 'PV', 'NPV', 'IRR', 'RATE', 'NPER', 'IPMT', 'PPMT', 'SLN', 'DB', 'XNPV', 'XIRR'],
  Logical: ['IF', 'IFS', 'AND', 'OR', 'NOT', 'XOR', 'IFERROR', 'IFNA', 'SWITCH', 'TRUE', 'FALSE'],
  Text: [
    'CONCAT',
    'TEXTJOIN',
    'LEFT',
    'RIGHT',
    'MID',
    'LEN',
    'TRIM',
    'UPPER',
    'LOWER',
    'PROPER',
    'SUBSTITUTE',
    'TEXT',
    'FIND',
    'REPLACE',
  ],
  'Date & Time': [
    'TODAY',
    'NOW',
    'DATE',
    'YEAR',
    'MONTH',
    'DAY',
    'WEEKDAY',
    'EOMONTH',
    'EDATE',
    'DATEDIF',
    'NETWORKDAYS',
    'WORKDAY',
  ],
  'Lookup & Reference': [
    'VLOOKUP',
    'HLOOKUP',
    'XLOOKUP',
    'INDEX',
    'MATCH',
    'OFFSET',
    'INDIRECT',
    'CHOOSE',
    'ROW',
    'COLUMN',
    'TRANSPOSE',
  ],
  'Math & Trig': [
    'SUM',
    'SUMIF',
    'SUMIFS',
    'SUMPRODUCT',
    'ROUND',
    'ROUNDUP',
    'ROUNDDOWN',
    'MOD',
    'ABS',
    'POWER',
    'SQRT',
    'RAND',
    'RANDBETWEEN',
    'INT',
  ],
  Statistical: [
    'AVERAGE',
    'AVERAGEIF',
    'COUNT',
    'COUNTA',
    'COUNTIF',
    'COUNTIFS',
    'MAX',
    'MIN',
    'MEDIAN',
    'MODE',
    'STDEV',
    'VAR',
    'LARGE',
    'SMALL',
    'RANK',
    'CORREL',
  ],
  'More functions': [
    'ISNUMBER',
    'ISTEXT',
    'ISBLANK',
    'ISERROR',
    'CONVERT',
    'BIN2DEC',
    'DEC2BIN',
    'HEX2DEC',
    'FILTER',
    'SORT',
    'UNIQUE',
    'SEQUENCE',
  ],
};
export const AUTOSUM_FUNCS: [string, string][] = [
  ['SUM', 'Sum'],
  ['AVERAGE', 'Average'],
  ['COUNT', 'Count numbers'],
  ['MAX', 'Max'],
  ['MIN', 'Min'],
];
export const SYMBOLS = '© ® ™ ° ± × ÷ ≤ ≥ ≠ ≈ π Ω µ ∞ √ ∑ € £ ¥ ₹ ¢ ✓ ✗ → ← ↑ ↓ ★ ☆ • … § ¶ ½ ¼ ¾ ²  ³'
  .split(/\s+/)
  .filter(Boolean);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const categorySlug = slug;

export function registerGap(add: AddFn, eng: () => Engine | null): void {
  const active = () => {
    const e = eng();
    const w = e?.api.getActiveWorkbook();
    const rg = w?.getActiveRange();
    return e && w && rg ? { e, w, rg } : null;
  };
  const cellOf = () => {
    const a = active();
    return a ? a.w.getActiveSheet().getRange(a.rg.getRow(), a.rg.getColumn()) : null;
  };
  for (const [cat, fns] of Object.entries(FUNCTION_LIBRARY))
    for (const f of fns)
      add(
        `fx.${slug(cat)}.${f.toLowerCase()}`,
        `Insert ${f}()`,
        'Formulas',
        () => {
          const c = cellOf();
          if (!c) return;
          c.setFormula(`=${f}()`);
          toast(`${f} inserted — fill in its arguments in the formula bar`, 'info');
        },
        `function ${cat.toLowerCase()} ${f.toLowerCase()}`,
      );
  for (const [f, title] of AUTOSUM_FUNCS)
    add(
      `edit.autosum.${f.toLowerCase()}`,
      `AutoSum: ${title}`,
      'Edit',
      () => {
        const a = active();
        if (!a) return;
        const sh = a.w.getActiveSheet();
        const r = a.rg.getRow(),
          c = a.rg.getColumn();
        const isNum = (rr: number, cc: number) => typeof sh.getRange(rr, cc).getValue() === 'number';
        let top = r - 1;
        while (top >= 0 && isNum(top, c)) top--;
        let left = c - 1;
        while (left >= 0 && isNum(r, left)) left--;
        const target = sh.getRange(r, c);
        if (top < r - 1)
          target.setFormula(
            `=${f}(${sh.getRange(top + 1, c).getA1Notation()}:${sh.getRange(r - 1, c).getA1Notation()})`,
          );
        else if (left < c - 1)
          target.setFormula(
            `=${f}(${sh.getRange(r, left + 1).getA1Notation()}:${sh.getRange(r, c - 1).getA1Notation()})`,
          );
        else target.setFormula(`=${f}()`);
      },
      'total add average count max min',
    );
  SYMBOLS.forEach((s, i) =>
    add(
      `insert.symbol.${i}`,
      `Insert symbol ${s}`,
      'Insert',
      () => {
        const c = cellOf();
        if (!c) return;
        const cur = c.getValue();
        c.setValue(`${cur == null ? '' : String(cur)}${s}`);
      },
      'symbol character special',
    ),
  );
  add(
    'calc.now',
    'Calculate now',
    'Formulas',
    async () => {
      const e = eng();
      const f = (
        e?.api as unknown as { getFormula?: () => { executeCalculation?: () => void } } | undefined
      )?.getFormula?.();
      f?.executeCalculation?.();
      toast('Workbook recalculated', 'ok');
    },
    'recalculate f9',
  );
  add(
    'view.formulabar',
    'Show / hide the formula bar',
    'View',
    () => {
      const off = document.body.classList.toggle('no-fbar');
      window.dispatchEvent(new Event('resize'));
      toast(off ? 'Formula bar hidden' : 'Formula bar shown', 'info');
    },
    'formula bar',
  );
}

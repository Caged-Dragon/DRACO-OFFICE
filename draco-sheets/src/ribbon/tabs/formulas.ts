import { bigGroup, stacked, type Group, type RibbonCtx } from '../types';
import { AUTOSUM_FUNCS, FUNCTION_LIBRARY, categorySlug } from '../../cmd/gapCmds';

const CAT_ICON: Record<string, string> = {
  Financial: '💲',
  Logical: '⇌',
  Text: 'A',
  'Date & Time': '📅',
  'Lookup & Reference': '🔎',
  'Math & Trig': '∑',
  Statistical: '📈',
  'More functions': '⋯',
};

type Tr = {
  trace: (m: 'precedents' | 'dependents') => unknown;
  clear: () => unknown;
  circleInvalid: () => unknown;
  clearCircles: () => unknown;
};
const tr = () => (window as unknown as { dracoTrace?: Tr }).dracoTrace;

/** Formulas tab */
export const formulasGroups = (_x: RibbonCtx): Group[] => [
  bigGroup('Function Library', [
    { l: 'Insert function', i: 'ƒx', c: 'open.formulas' },
    {
      l: 'AutoSum',
      i: 'Σ',
      c: 'edit.autosum',
      menu: AUTOSUM_FUNCS.map(([f, n]) => ({ l: n, i: 'Σ', c: `edit.autosum.${f.toLowerCase()}` })),
    },
    ...Object.entries(FUNCTION_LIBRARY).map(([cat, fns]) => ({
      l: cat,
      i: CAT_ICON[cat] ?? 'ƒ',
      c: `fx.${categorySlug(cat)}.${fns[0].toLowerCase()}`,
      menu: fns.map((f) => ({ l: f, i: 'ƒ', c: `fx.${categorySlug(cat)}.${f.toLowerCase()}` })),
    })),
  ]),
  bigGroup('Defined Names', [{ l: 'Name manager', i: '🏷', c: 'open.formulas' }]),
  stacked('Formula Auditing', [
    [
      { l: 'Trace precedents', i: '↖', run: () => void tr()?.trace('precedents') },
      { l: 'Trace dependents', i: '↘', run: () => void tr()?.trace('dependents') },
      { l: 'Remove arrows', i: '✖', run: () => void tr()?.clear() },
    ],
    [
      {
        l: 'Error checking',
        i: '⚠',
        c: 'open.formulas.errors',
        menu: [
          { l: 'Error checking', i: '⚠', c: 'open.formulas.errors' },
          { l: 'Circle invalid data', i: '⭕', run: () => void tr()?.circleInvalid() },
          { l: 'Clear validation circles', i: '○', run: () => void tr()?.clearCircles() },
        ],
      },
      { l: 'Evaluate formula', i: '🔍', c: 'open.formulas.evaluate' },
      { l: 'Watch window', i: '👁', c: 'open.formulas.watch' },
    ],
  ]),
  bigGroup('Calculation', [
    { l: 'Calculate now', i: '⟳', c: 'calc.now' },
    { l: 'Calculation options', i: '⚙', c: 'open.formulas.calc' },
  ]),
  bigGroup('Analysis', [{ l: 'Analysis ToolPak', i: '∑', c: 'open.analysis' }]),
];

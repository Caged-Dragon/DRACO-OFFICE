import type { Group, RibbonCtx } from '../types';

type Tr = { trace: (m: 'precedents' | 'dependents') => unknown; clear: () => unknown; circleInvalid: () => unknown; clearCircles: () => unknown };
const tr = () => (window as unknown as { dracoTrace?: Tr }).dracoTrace;

/** Formulas tab */
export const formulasGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Function Library', items: [{ l: 'Insert function', i: 'ƒx', c: 'open.formulas' }, { l: 'AutoSum', i: 'Σ', c: 'edit.autosum' }, { l: 'Recent / Financial / Logical…', i: '📚', c: 'open.formulas' }] },
      { n: 'Defined Names', items: [{ l: 'Name manager', i: '🏷', c: 'open.formulas' }] },
      { n: 'Formula Auditing', items: [
        { l: 'Trace precedents', i: '↖', run: () => void tr()?.trace('precedents') },
        { l: 'Trace dependents', i: '↘', run: () => void tr()?.trace('dependents') },
        { l: 'Remove arrows', i: '✖', run: () => void tr()?.clear() },
        { l: 'Error checking', i: '⚠', c: 'open.formulas.errors' },
        { l: 'Circle invalid data', i: '⭕', run: () => void tr()?.circleInvalid() },
        { l: 'Clear circles', i: '○', run: () => void tr()?.clearCircles() },
        { l: 'Evaluate formula', i: '🔍', c: 'open.formulas.evaluate' },
        { l: 'Watch window', i: '👁', c: 'open.formulas.watch' }] },
      { n: 'Calculation', items: [{ l: 'Calculation options', i: '⚙', c: 'open.formulas.calc' }] },
      { n: 'Analysis', items: [{ l: 'Analysis ToolPak', i: '∑', c: 'open.analysis' }] },
];

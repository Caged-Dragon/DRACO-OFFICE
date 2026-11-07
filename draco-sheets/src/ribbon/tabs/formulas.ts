import type { Group, RibbonCtx } from '../types';

/** Formulas tab */
export const formulasGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Function Library', items: [{ l: 'Insert function', i: 'ƒx', c: 'open.formulas' }, { l: 'AutoSum', i: 'Σ', c: 'edit.autosum' }, { l: 'Recent / Financial / Logical…', i: '📚', c: 'open.formulas' }] },
      { n: 'Defined Names', items: [{ l: 'Name manager', i: '🏷', c: 'open.formulas' }] },
      { n: 'Formula Auditing', items: [{ l: 'Trace precedents', i: '↖', c: 'open.formulas' }, { l: 'Trace dependents', i: '↘', c: 'open.formulas' }, { l: 'Error checking', i: '⚠', c: 'open.formulas' }, { l: 'Evaluate formula', i: '🔍', c: 'open.formulas' }, { l: 'Watch window', i: '👁', c: 'open.formulas' }] },
      { n: 'Calculation', items: [{ l: 'Calculation options', i: '⚙', c: 'open.formulas' }] },
      { n: 'Analysis', items: [{ l: 'Analysis ToolPak', i: '∑', c: 'open.analysis' }] },
];

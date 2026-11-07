import type { Group, RibbonCtx } from '../types';

/** Automate tab */
export const automateGroups = (x: RibbonCtx): Group[] => [
      { n: 'Automate', items: [{ l: 'Macros', i: '⏺', c: 'open.macros' }, { l: 'Scripts', i: '{ }', c: 'open.scripts' }, { l: 'Command search', i: '⌕', run: x.palette }] },
];

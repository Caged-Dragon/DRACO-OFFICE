import type { Group, RibbonCtx } from '../types';

/** Help tab */
export const helpGroups = (x: RibbonCtx): Group[] => [
      { n: 'Help', items: [{ l: 'Keyboard shortcuts', i: '⌨', c: 'open.shortcuts' }, { l: 'Feature status', i: '☑', c: 'open.parity' }, { l: 'Command search', i: '⌕', run: x.palette }] },
      { n: 'App', items: [{ l: 'Settings', i: '⚙', run: x.settings }, { l: 'About', i: 'ⓘ', run: () => { history.pushState(null, '', '/about'); window.dispatchEvent(new PopStateEvent('popstate')); } }] },
];

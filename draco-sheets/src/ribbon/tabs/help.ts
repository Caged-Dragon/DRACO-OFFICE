import { bigGroup, type Group, type RibbonCtx } from '../types';

/** Help tab */
export const helpGroups = (x: RibbonCtx): Group[] => [
  bigGroup('Help', [
    { l: 'Keyboard shortcuts', i: '⌨', c: 'open.shortcuts' },
    { l: 'Feature status', i: '☑', c: 'open.parity' },
    { l: 'Command search', i: '⌕', run: x.palette },
  ]),
  bigGroup('App', [
    { l: 'Settings', i: '⚙', run: x.settings },
    {
      l: 'About',
      i: 'ⓘ',
      run: () => {
        history.pushState(null, '', '/about');
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
    },
  ]),
];

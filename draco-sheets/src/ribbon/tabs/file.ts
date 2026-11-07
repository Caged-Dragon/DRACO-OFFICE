import type { Group, RibbonCtx } from '../types';

/** File tab */
export const fileGroups = (x: RibbonCtx): Group[] => [
      { n: 'Workbook', items: [{ l: 'New', i: '🗋', run: x.newWb }, { l: 'Open', i: '🗁', c: 'open.files' }, { l: 'Save', i: '💾', run: x.save }, { l: 'Import / Export', i: '⇅', c: 'open.files' }] },
      { n: 'Output', items: [{ l: 'Print / PDF', i: '🖶', c: 'open.print' }, { l: 'Version history', i: '⟲', c: 'open.versions' }] },
      { n: 'Share', items: [{ l: 'Share', i: '⇪', c: 'open.share' }] },
      { n: 'App', items: [{ l: 'Start screen', i: '⌂', run: x.home }, { l: 'Options', i: '⚙', run: x.settings }] },
];

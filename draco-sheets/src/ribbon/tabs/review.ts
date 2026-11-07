import type { Group, RibbonCtx } from '../types';

/** Review tab */
export const reviewGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Accessibility', items: [{ l: 'Check accessibility', i: '♿', c: 'open.access' }] },
      { n: 'Language', items: [{ l: 'Language & region', i: '🌐', c: 'open.lang' }] },
      { n: 'Comments', items: [{ l: 'Comments', i: '💬', c: 'open.comments' }, { l: 'Notes', i: '📝', c: 'open.notes' }] },
      { n: 'Changes', items: [{ l: 'Track changes', i: '✎', c: 'open.changes' }, { l: 'Protect sheet / workbook', i: '🔒', c: 'open.protect' }, { l: 'Share', i: '⇪', c: 'open.share' }] },
];

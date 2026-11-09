import { bigGroup, type Group, type RibbonCtx } from '../types';

/** Review tab */
export const reviewGroups = (_x: RibbonCtx): Group[] => [
  bigGroup('Accessibility', [{ l: 'Check accessibility', i: '♿', c: 'open.access' }]),
  bigGroup('Language', [{ l: 'Language & region', i: '🌐', c: 'open.lang' }]),
  bigGroup('Comments', [
    { l: 'Comments', i: '💬', c: 'open.comments' },
    { l: 'Notes', i: '📝', c: 'open.notes' },
  ]),
  bigGroup('Changes', [
    { l: 'Track changes', i: '✎', c: 'open.changes' },
    { l: 'Protect', i: '🔒', c: 'open.protect' },
    { l: 'Share', i: '⇪', c: 'open.share' },
  ]),
];

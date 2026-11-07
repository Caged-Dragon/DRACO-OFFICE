import type { Group, RibbonCtx } from '../types';

/** Insert tab */
export const insertGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Tables', items: [{ l: 'PivotTable', i: '⊞', c: 'open.pivot' }, { l: 'Table', i: '▦', c: 'open.tables' }] },
      { n: 'Illustrations', items: [{ l: 'Pictures & shapes', i: '🖼', c: 'open.objects' }, { l: 'Text box', i: '🅣', c: 'open.objects' }] },
      { n: 'Charts', items: [{ l: 'Charts', i: '📊', c: 'open.charts' }, { l: 'Recommended', i: '✨', c: 'open.charts' }, { l: 'Maps & 3-D', i: '🌐', c: 'open.charts' }] },
      { n: 'Sparklines', items: [{ l: 'Line / Column / Win-Loss', i: '〰', c: 'open.objects' }] },
      { n: 'Filters', items: [{ l: 'Slicer', i: '⧩', c: 'open.tables' }, { l: 'Timeline', i: '🕒', c: 'open.pivot' }] },
      { n: 'Links', items: [{ l: 'Link', i: '🔗', c: 'open.links' }] },
      { n: 'Comments', items: [{ l: 'Comment', i: '💬', c: 'open.comments' }, { l: 'Note', i: '📝', c: 'open.notes' }] },
      { n: 'Text', items: [{ l: 'Date', i: '📅', c: 'edit.today' }, { l: 'Time', i: '⏱', c: 'edit.now' }] },
];

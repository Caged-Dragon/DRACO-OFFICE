import type { Group, RibbonCtx } from '../types';

/** View tab */
export const viewGroups = (x: RibbonCtx): Group[] => [
      { n: 'Workbook Views', items: [{ l: 'Normal', i: '▦', run: () => undefined }, { l: 'Command search', i: '⌕', run: x.palette }] },
      { n: 'Show', items: [{ l: 'Gridlines', i: '▦', c: 'view.grid' }, { l: 'Headings', i: '#', c: 'view.headings' }] },
      { n: 'Zoom', items: [{ l: 'Zoom in', i: '🔍＋', c: 'view.zoomin' }, { l: 'Zoom out', i: '🔍－', c: 'view.zoomout' }, { l: '50%', i: '½', c: 'view.zoom50' }, { l: '75%', i: '¾', c: 'view.zoom75' }, { l: '100%', i: '1×', c: 'view.zoom100' }, { l: '150%', i: '1½', c: 'view.zoom150' }, { l: '200%', i: '2×', c: 'view.zoom200' }] },
      { n: 'Freeze', items: [{ l: 'Freeze top row', i: '⤒', c: 'view.freezerow' }, { l: 'Freeze first column', i: '⇤', c: 'view.freezecol' }, { l: 'Freeze at selection', i: '⊞', c: 'view.freezesel' }, { l: 'Unfreeze', i: '⊡', c: 'view.unfreeze' }] },
      { n: 'Sheets', items: [{ l: 'New sheet', i: '＋', c: 'sheet.new' }, { l: 'Duplicate', i: '⧉', c: 'sheet.dup' }, { l: 'Hide sheet', i: '🙈', c: 'sheet.hide' }, { l: 'Delete', i: '🗑', c: 'sheet.delete' }, { l: 'Previous', i: '◀', c: 'sheet.prev' }, { l: 'Next', i: '▶', c: 'sheet.next' }] },
      { n: 'Performance', items: [{ l: 'Large data', i: '⚡', c: 'open.perf' }] },
];

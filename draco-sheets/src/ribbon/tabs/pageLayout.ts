import type { Group, RibbonCtx } from '../types';

/** Page Layout tab */
export const pageLayoutGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Themes', items: [{ l: 'Themes', i: 'Aa', c: 'open.templates' }, { l: 'Colours & fonts', i: '🎨', c: 'open.styles' }] },
      { n: 'Page Setup', items: [{ l: 'Margins', i: '▣', c: 'open.print' }, { l: 'Orientation', i: '⟳', c: 'open.print' }, { l: 'Size', i: '▯', c: 'open.print' }, { l: 'Print area', i: '⌗', c: 'open.print' }, { l: 'Print titles', i: '☰', c: 'open.print' }] },
      { n: 'Scale to Fit', items: [{ l: 'Width / Height / Scale', i: '⤢', c: 'open.print' }] },
      { n: 'Sheet Options', items: [{ l: 'Gridlines view', i: '▦', c: 'view.grid' }, { l: 'Print settings', i: '🖶', c: 'open.print' }] },
];

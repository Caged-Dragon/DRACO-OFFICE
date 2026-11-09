import { bigGroup, type Group, type RibbonCtx } from '../types';

/** Page Layout tab */
export const pageLayoutGroups = (_x: RibbonCtx): Group[] => [
  bigGroup('Themes', [
    { l: 'Themes', i: 'Aa', c: 'open.templates' },
    { l: 'Colours & fonts', i: '🎨', c: 'open.styles' },
  ]),
  bigGroup('Page Setup', [
    { l: 'Margins', i: '▣', c: 'open.print' },
    { l: 'Orientation', i: '⟳', c: 'open.print' },
    { l: 'Size', i: '▯', c: 'open.print' },
    { l: 'Print area', i: '⌗', c: 'open.print' },
    { l: 'Print titles', i: '☰', c: 'open.print' },
  ]),
  bigGroup('Scale to Fit', [{ l: 'Scale', i: '⤢', c: 'open.print' }]),
  bigGroup('Sheet Options', [
    { l: 'Gridlines', i: '▦', c: 'view.grid' },
    { l: 'Print', i: '🖶', c: 'open.print' },
  ]),
];

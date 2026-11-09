import { bigGroup, stacked, type Group, type RibbonCtx } from '../types';
import { swatches } from './home/palette';

/** View tab */
export const viewGroups = (x: RibbonCtx): Group[] => [
  bigGroup('Views', [
    { l: 'Command search', i: '⌕', run: x.palette },
    { l: 'Large data', i: '⚡', c: 'open.perf' },
  ]),
  bigGroup('Show', [
    { l: 'Gridlines', i: '▦', c: 'view.grid' },
    { l: 'Headings', i: '#', c: 'view.headings' },
    { l: 'Formula bar', i: 'ƒx', c: 'view.formulabar' },
  ]),
  bigGroup('Zoom', [
    {
      l: 'Zoom',
      i: '🔍',
      c: 'view.zoom100',
      menu: [50, 75, 100, 150, 200].map((n) => ({ l: `${n}%`, i: '🔍', c: `view.zoom${n}` })),
    },
    { l: 'Zoom in', i: '＋', c: 'view.zoomin' },
    { l: 'Zoom out', i: '－', c: 'view.zoomout' },
  ]),
  bigGroup('Window', [
    {
      l: 'Freeze panes',
      i: '❄',
      c: 'view.freezesel',
      menu: [
        { l: 'Freeze at selection', i: '⊞', c: 'view.freezesel' },
        { l: 'Freeze top row', i: '⤒', c: 'view.freezerow' },
        { l: 'Freeze first column', i: '⇤', c: 'view.freezecol' },
        { l: 'Unfreeze', i: '⊡', c: 'view.unfreeze' },
      ],
    },
    { l: 'Full screen', i: '⛶', c: 'view.fullscreen' },
  ]),
  stacked('Sheets', [
    [
      { l: 'New sheet', i: '＋', c: 'sheet.new' },
      { l: 'Duplicate', i: '⧉', c: 'sheet.dup' },
      { l: 'Delete', i: '🗑', c: 'sheet.delete' },
      { l: 'Rename', i: '✎', c: 'sheet.rename' },
    ],
    [
      { l: 'Previous', i: '◀', c: 'sheet.prev' },
      { l: 'Next', i: '▶', c: 'sheet.next' },
      { l: 'Move left', i: '⇤', c: 'sheet.moveleft' },
      { l: 'Move right', i: '⇥', c: 'sheet.moveright' },
    ],
    [
      { l: 'Hide sheet', i: '🙈', c: 'sheet.hide' },
      { l: 'Unhide all', i: '👁', c: 'sheet.unhide' },
      {
        l: 'Tab colour',
        i: '■',
        grid: true,
        menu: [...swatches('sheet.tab', 'Tab'), { l: 'No tab colour', i: '□', c: 'sheet.tab.none' }],
      },
    ],
  ]),
];

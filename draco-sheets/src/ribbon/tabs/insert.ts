import { bigGroup, stacked, type Group, type RibbonCtx } from '../types';
import { CHART_KINDS, SHAPE_KINDS } from '../../cmd/insertCmds';
import { SYMBOLS } from '../../cmd/gapCmds';

/** Insert tab */
export const insertGroups = (_x: RibbonCtx): Group[] => [
  bigGroup('Tables', [
    { l: 'PivotTable', i: '⊞', c: 'open.pivot' },
    { l: 'Table', i: '▦', c: 'open.tables' },
  ]),
  bigGroup('Illustrations', [
    {
      l: 'Shapes',
      i: '⬠',
      c: 'insert.shape.rect',
      menu: SHAPE_KINDS.map(([k, n]) => ({ l: n, i: '⬠', c: `insert.shape.${k}` })),
    },
    { l: 'Pictures & icons', i: '🖼', c: 'open.objects' },
  ]),
  bigGroup('Charts', [
    {
      l: 'Column',
      i: '📊',
      c: 'insert.chart.column',
      menu: CHART_KINDS.map(([k, n]) => ({ l: n, i: '📊', c: `insert.chart.${k}` })),
    },
    { l: 'Line', i: '📈', c: 'insert.chart.line' },
    { l: 'Pie', i: '◔', c: 'insert.chart.pie' },
    { l: 'All charts', i: '✨', c: 'open.charts' },
  ]),
  bigGroup('Sparklines', [{ l: 'Sparklines', i: '〰', c: 'open.objects' }]),
  bigGroup('Filters', [
    { l: 'Slicer', i: '⧩', c: 'open.tables' },
    { l: 'Timeline', i: '🕒', c: 'open.pivot' },
  ]),
  bigGroup('Links', [
    { l: 'Hyperlink', i: '🔗', c: 'insert.hyperlink' },
    { l: 'Web & links', i: '🌐', c: 'open.links' },
  ]),
  bigGroup('Symbols', [
    {
      l: 'Symbol',
      i: 'Ω',
      c: 'insert.symbol.0',
      grid: true,
      menu: SYMBOLS.map((s, i) => ({ l: s, i: s, c: `insert.symbol.${i}` })),
    },
  ]),
  bigGroup('Comments', [
    { l: 'Comment', i: '💬', c: 'open.comments' },
    { l: 'Note', i: '📝', c: 'open.notes' },
  ]),
  stacked('Text', [
    [{ l: 'Text box', i: '🅣', c: 'insert.shape.text' }],
    [
      { l: 'Date', i: '📅', c: 'edit.today' },
      { l: 'Time', i: '⏱', c: 'edit.now' },
    ],
  ]),
];

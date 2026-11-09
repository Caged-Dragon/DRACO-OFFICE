import { stacked } from '../../types';
const H = [15, 20, 30, 45],
  W = [64, 100, 150, 220];
/** Home › Cells: Insert / Delete / Format drop-downs. */
export const cellsGroup = stacked('Cells', [
  [
    {
      l: 'Insert',
      i: '⊞',
      menu: [
        { l: 'Insert row above', i: '⤒', c: 'row.above' },
        { l: 'Insert row below', i: '⤓', c: 'row.below' },
        { l: 'Insert column left', i: '⇤', c: 'col.left' },
        { l: 'Insert column right', i: '⇥', c: 'col.right' },
        { l: 'Insert cells, shift right', i: '⇥', c: 'cell.insert.right' },
        { l: 'Insert cells, shift down', i: '⤓', c: 'cell.insert.down' },
      ],
    },
  ],
  [
    {
      l: 'Delete',
      i: '⊖',
      menu: [
        { l: 'Delete rows', i: '⊖', c: 'row.delete' },
        { l: 'Delete columns', i: '⊟', c: 'col.delete' },
        { l: 'Delete cells, shift left', i: '⇤', c: 'cell.delete.left' },
        { l: 'Delete cells, shift up', i: '⤒', c: 'cell.delete.up' },
      ],
    },
  ],
  [
    {
      l: 'Format',
      i: '▤',
      menu: [
        ...H.map((h) => ({ l: `Row height ${h}`, i: '▭', c: `row.height.${h}` })),
        { l: 'AutoFit row height', i: '↕', c: 'row.autofit' },
        ...W.map((x) => ({ l: `Column width ${x}`, i: '▯', c: `col.width.${x}` })),
        { l: 'AutoFit column width', i: '↔', c: 'col.autofit' },
        { l: 'Hide rows', i: '▭', c: 'row.hide' },
        { l: 'Unhide rows', i: '▤', c: 'row.show' },
        { l: 'Hide columns', i: '▯', c: 'col.hide' },
        { l: 'Unhide columns', i: '▥', c: 'col.show' },
        { l: 'Rename sheet', i: '✎', c: 'sheet.rename' },
      ],
    },
  ],
]);

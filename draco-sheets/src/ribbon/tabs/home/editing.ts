import { stacked } from '../../types';
/** Home › Editing */
export const editingGroup = stacked('Editing', [
  [
    { l: 'AutoSum', i: 'Σ', c: 'edit.autosum' },
    {
      l: 'Fill',
      i: '⇩',
      c: 'edit.filldown',
      menu: [
        { l: 'Fill down', i: '⇩', c: 'edit.filldown' },
        { l: 'Fill right', i: '⇨', c: 'edit.fillright' },
      ],
    },
  ],
  [
    {
      l: 'Clear',
      i: '⌫',
      c: 'edit.clearc',
      menu: [
        { l: 'Clear contents', i: '⌫', c: 'edit.clearc' },
        { l: 'Clear formats', i: '✕', c: 'fmt.clear' },
        { l: 'Clear all', i: '⌧', c: 'edit.clearall' },
      ],
    },
    {
      l: 'Sort and filter',
      i: 'A↓',
      c: 'data.sortaz',
      menu: [
        { l: 'Sort A to Z', i: 'A↓', c: 'data.sortaz' },
        { l: 'Sort Z to A', i: 'Z↓', c: 'data.sortza' },
        { l: 'Filter', i: '⛛', c: 'data.filter' },
      ],
    },
  ],
  [
    {
      l: 'Find and select',
      i: '🔍',
      c: 'edit.find',
      menu: [
        { l: 'Find', i: '🔍', c: 'edit.find' },
        { l: 'Replace', i: '⇄', c: 'edit.replace' },
        { l: 'Select all cells', i: '▣', c: 'edit.selectall' },
      ],
    },
  ],
]);

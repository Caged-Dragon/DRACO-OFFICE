import { stacked } from '../../types';
/** Home › Clipboard */
export const clipboardGroup = stacked('Clipboard', [
  [
    {
      l: 'Paste',
      i: '📋',
      c: 'edit.paste',
      menu: [
        { l: 'Paste', i: '📋', c: 'edit.paste' },
        { l: 'Paste values only', i: '123', c: 'edit.paste.values' },
        { l: 'Paste formulas only', i: 'ƒ', c: 'edit.paste.formulas' },
        { l: 'Paste formatting only', i: '🎨', c: 'edit.paste.format' },
        { l: 'Paste column widths', i: '↔', c: 'edit.paste.widths' },
        { l: 'Paste except borders', i: '▭', c: 'edit.paste.noborder' },
      ],
    },
    { l: 'Cut', i: '✂', c: 'edit.cut' },
    { l: 'Copy', i: '⧉', c: 'edit.copy' },
  ],
  [
    {
      l: 'Format painter',
      i: '🖌',
      c: 'edit.painter',
      menu: [
        { l: 'Format painter (once)', i: '🖌', c: 'edit.painter' },
        { l: 'Format painter (keep on)', i: '🖌', c: 'edit.painter.multi' },
      ],
    },
    { l: 'Undo', i: '↶', c: 'edit.undo' },
    { l: 'Redo', i: '↷', c: 'edit.redo' },
  ],
]);

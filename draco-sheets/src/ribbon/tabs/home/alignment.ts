import { stacked } from '../../types';
/** Home › Alignment */
export const alignmentGroup = stacked('Alignment', [
  [
    { l: 'Align top', i: '⤒', c: 'fmt.valign.top' },
    { l: 'Align middle', i: '↕', c: 'fmt.valign.middle' },
    { l: 'Align bottom', i: '⤓', c: 'fmt.valign.bottom' },
    {
      l: 'Orientation',
      i: '⤢',
      c: 'fmt.rotate.up',
      menu: [
        { l: 'Angle counterclockwise', i: '⤢', c: 'fmt.rotate.up' },
        { l: 'Angle clockwise', i: '⤡', c: 'fmt.rotate.down' },
        { l: 'Rotate text up', i: '↑', c: 'fmt.rotate.vertical' },
        { l: 'Rotate text down', i: '↓', c: 'fmt.rotate.vertdown' },
        { l: 'Horizontal text', i: '—', c: 'fmt.rotate.none' },
      ],
    },
  ],
  [
    { l: 'Align left', i: '⇤', c: 'fmt.left' },
    { l: 'Centre', i: '↔', c: 'fmt.center' },
    { l: 'Align right', i: '⇥', c: 'fmt.right' },
    { l: 'Decrease indent', i: '⇤', c: 'fmt.indent.less' },
    { l: 'Increase indent', i: '⇥', c: 'fmt.indent.more' },
  ],
  [
    {
      l: 'Wrap text',
      i: '↵',
      c: 'fmt.wrap',
      menu: [
        { l: 'Wrap text', i: '↵', c: 'fmt.wrap' },
        { l: 'Text overflow (no wrap)', i: '→', c: 'fmt.overflow' },
        { l: 'Shrink to fit', i: '⇲', c: 'fmt.shrink' },
      ],
    },
    {
      l: 'Merge and centre',
      i: '⊞',
      c: 'fmt.mergecenter',
      menu: [
        { l: 'Merge and centre', i: '⊞', c: 'fmt.mergecenter' },
        { l: 'Merge cells', i: '⊞', c: 'fmt.merge' },
        { l: 'Merge across', i: '⇔', c: 'fmt.merge.across' },
        { l: 'Merge down', i: '⇕', c: 'fmt.merge.down' },
        { l: 'Unmerge cells', i: '⊟', c: 'fmt.unmerge' },
      ],
    },
  ],
]);

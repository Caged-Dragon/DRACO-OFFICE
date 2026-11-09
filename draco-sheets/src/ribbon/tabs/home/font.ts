import { stacked } from '../../types';
import { swatches } from './palette';
const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
/** Home › Font */
export const fontGroup = stacked('Font', [
  [
    {
      l: 'Font',
      text: 'Font',
      menu: FONTS.map((f) => ({ l: f, i: 'Aa', font: f, c: `fmt.font.${f.toLowerCase().replace(/ /g, '-')}` })),
    },
    {
      l: 'Font size',
      text: 'Size',
      menu: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((n) => ({ l: String(n), c: `fmt.size.${n}` })),
    },
    { l: 'Bigger', i: 'A+', c: 'fmt.fsup' },
    { l: 'Smaller', i: 'A−', c: 'fmt.fsdown' },
  ],
  [
    { l: 'Bold', i: 'B', c: 'fmt.bold' },
    { l: 'Italic', i: 'I', c: 'fmt.italic' },
    {
      l: 'Underline',
      i: 'U',
      c: 'fmt.underline',
      menu: [
        { l: 'Underline', i: 'U', c: 'fmt.underline' },
        { l: 'Double underline', i: 'U̲', c: 'fmt.underline.double' },
      ],
    },
    { l: 'Strikethrough', i: 'S', c: 'fmt.strike' },
    {
      l: 'Borders',
      i: '▦',
      c: 'fmt.border.all',
      menu: [
        { l: 'All borders', i: '▦', c: 'fmt.border.all' },
        { l: 'Outside borders', i: '▢', c: 'fmt.border.outside' },
        { l: 'Thick outside border', i: '◼', c: 'fmt.border.thick' },
        { l: 'Bottom border', i: '▁', c: 'fmt.border.bottom' },
        { l: 'Double bottom border', i: '═', c: 'fmt.border.double' },
        { l: 'Top border', i: '▔', c: 'fmt.border.top' },
        { l: 'Left border', i: '▏', c: 'fmt.border.left' },
        { l: 'Right border', i: '▕', c: 'fmt.border.right' },
        { l: 'No border', i: '☐', c: 'fmt.border.none' },
      ],
    },
    {
      l: 'Fill colour',
      i: '◩',
      grid: true,
      menu: [...swatches('fill', 'Fill'), { l: 'No fill', i: '□', c: 'fmt.fill.none' }],
    },
    {
      l: 'Font colour',
      i: 'A',
      grid: true,
      menu: [...swatches('color', 'Text'), { l: 'Automatic font colour', i: 'A', c: 'fmt.color.auto' }],
    },
  ],
]);

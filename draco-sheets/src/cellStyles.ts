// Excel "Cell Styles" gallery (v20): named presets applied to the current selection.
export interface CellStyle {
  name: string;
  group: 'Good, Bad and Neutral' | 'Data and Model' | 'Titles and Headings' | 'Themed Cell Styles' | 'Number Format';
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  family?: string;
  border?: 'bottom' | 'bottom-thick' | 'bottom-double' | 'top-bottom-double' | 'top-bottom' | 'box' | 'box-double' | 'box-medium-orange';
  borderColor?: string;
  numfmt?: string;
}

const accents: Array<[string, string]> = [
  ['Accent1', '#4472C4'], ['Accent2', '#ED7D31'], ['Accent3', '#A5A5A5'],
  ['Accent4', '#FFC000'], ['Accent5', '#5B9BD5'], ['Accent6', '#70AD47'],
];
const tint = (hex: string, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

export const CELL_STYLES: CellStyle[] = [
  { name: 'Normal', group: 'Good, Bad and Neutral', fg: '#000000', bg: '#FFFFFF', family: 'Calibri', size: 11 },
  { name: 'Bad', group: 'Good, Bad and Neutral', fg: '#9C0006', bg: '#FFC7CE' },
  { name: 'Good', group: 'Good, Bad and Neutral', fg: '#006100', bg: '#C6EFCE' },
  { name: 'Neutral', group: 'Good, Bad and Neutral', fg: '#9C5700', bg: '#FFEB9C' },

  { name: 'Calculation', group: 'Data and Model', fg: '#FA7D00', bg: '#F2F2F2', bold: true, border: 'box', borderColor: '#7F7F7F' },
  { name: 'Check Cell', group: 'Data and Model', fg: '#FFFFFF', bg: '#A5A5A5', bold: true, border: 'box-double', borderColor: '#3F3F3F' },
  { name: 'Explanatory Text', group: 'Data and Model', fg: '#7F7F7F', italic: true },
  { name: 'Input', group: 'Data and Model', fg: '#3F3F76', bg: '#FFCC99', border: 'box', borderColor: '#7F7F7F' },
  { name: 'Linked Cell', group: 'Data and Model', fg: '#FA7D00', border: 'bottom-double', borderColor: '#FF8001' },
  { name: 'Note', group: 'Data and Model', bg: '#FFFFCC', border: 'box', borderColor: '#B2B2B2' },
  { name: 'Output', group: 'Data and Model', fg: '#3F3F3F', bg: '#F2F2F2', bold: true, border: 'box', borderColor: '#3F3F3F' },
  { name: 'Warning Text', group: 'Data and Model', fg: '#FF0000' },

  { name: 'Heading 1', group: 'Titles and Headings', fg: '#44546A', bold: true, size: 15, border: 'bottom-thick', borderColor: '#4472C4' },
  { name: 'Heading 2', group: 'Titles and Headings', fg: '#44546A', bold: true, size: 13, border: 'bottom-thick', borderColor: '#A9BCDF' },
  { name: 'Heading 3', group: 'Titles and Headings', fg: '#44546A', bold: true, size: 11, border: 'bottom', borderColor: '#8FAADC' },
  { name: 'Heading 4', group: 'Titles and Headings', fg: '#44546A', bold: true, size: 11 },
  { name: 'Title', group: 'Titles and Headings', fg: '#44546A', size: 18, family: 'Calibri Light' },
  { name: 'Total', group: 'Titles and Headings', bold: true, border: 'top-bottom-double', borderColor: '#4472C4' },

  ...([20, 40, 60] as const).flatMap((p) =>
    accents.map(([n, c]): CellStyle => ({
      name: `${p}% - ${n}`,
      group: 'Themed Cell Styles',
      bg: tint(c, p === 20 ? 0.8 : p === 40 ? 0.6 : 0.4), // 20% = lightest tint
      fg: p === 60 ? '#FFFFFF' : '#000000',
    })),
  ),
  ...accents.map(([n, c]): CellStyle => ({ name: n, group: 'Themed Cell Styles', bg: c, fg: '#FFFFFF' })),

  { name: 'Comma', group: 'Number Format', numfmt: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)' },
  { name: 'Comma [0]', group: 'Number Format', numfmt: '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)' },
  { name: 'Currency', group: 'Number Format', numfmt: '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)' },
  { name: 'Currency [0]', group: 'Number Format', numfmt: '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)' },
  { name: 'Percent', group: 'Number Format', numfmt: '0%' },
];

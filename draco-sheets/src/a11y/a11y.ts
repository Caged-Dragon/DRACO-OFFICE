// Accessibility (v96): settings model, colour contrast, cell announcements, accessibility checker. Pure.
import { a1, cellValue, orderedSheets, styleOf, usedExtent, type Snap } from '../files/model';
export interface A11y {
  highContrast: boolean;
  textScale: 100 | 115 | 130 | 150;
  reduceMotion: boolean;
  announce: boolean;
  strongFocus: boolean;
}
export const DEFAULT_A11Y: A11y = {
  highContrast: false,
  textScale: 100,
  reduceMotion: false,
  announce: false,
  strongFocus: false,
};
export function parseA11y(raw: string | null | undefined): A11y {
  try {
    const o = JSON.parse(raw ?? '') as Partial<A11y>;
    return {
      highContrast: !!o.highContrast,
      textScale: ([100, 115, 130, 150] as const).includes(o.textScale as never)
        ? (o.textScale as A11y['textScale'])
        : 100,
      reduceMotion: !!o.reduceMotion,
      announce: !!o.announce,
      strongFocus: !!o.strongFocus,
    };
  } catch {
    return { ...DEFAULT_A11Y };
  }
}
export function hexToRgb(h: string | undefined): [number, number, number] | null {
  if (!h) return null;
  let s = h.trim().replace('#', '');
  if (s.length === 3)
    s = s
      .split('')
      .map((x) => x + x)
      .join('');
  if (s.length === 8) s = s.slice(2);
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(rgb: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
export function contrastRatio(a: string, b: string): number | null {
  const x = hexToRgb(a),
    y = hexToRgb(b);
  if (!x || !y) return null;
  const l1 = luminance(x),
    l2 = luminance(y);
  const hi = Math.max(l1, l2),
    lo = Math.min(l1, l2);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
/** WCAG AA: 4.5 for normal text, 3 for large text (>=14pt bold or >=18pt). */
export const meetsAA = (ratio: number, sizePt = 11, bold = false) =>
  ratio >= (sizePt >= 18 || (bold && sizePt >= 14) ? 3 : 4.5);
export function describeCell(o: {
  sheet: string;
  a1: string;
  value: unknown;
  display?: string;
  formula?: string;
  rowHeader?: string;
  colHeader?: string;
  merged?: string;
  hyperlink?: string;
  note?: string;
  comments?: number;
}): string {
  const parts: string[] = [];
  const v = o.display ?? (o.value === null || o.value === undefined || o.value === '' ? '' : String(o.value));
  parts.push(`${o.a1}, ${v === '' ? 'blank' : v}`);
  if (o.colHeader && o.colHeader !== v) parts.push(`column ${o.colHeader}`);
  if (o.rowHeader && o.rowHeader !== v) parts.push(`row ${o.rowHeader}`);
  if (o.formula) parts.push(`formula ${o.formula.replace(/^=/, '')}`);
  if (o.merged) parts.push(`merged ${o.merged}`);
  if (o.hyperlink) parts.push('link');
  if (o.note) parts.push('has note');
  if (o.comments) parts.push(`${o.comments} comment${o.comments === 1 ? '' : 's'}`);
  return parts.join(', ') + `. ${o.sheet}.`;
}
export interface Issue {
  id: string;
  kind: 'contrast' | 'merged' | 'sheetname' | 'tinyfont' | 'linktext' | 'empty' | 'noheader' | 'colorfill';
  severity: 'error' | 'warning' | 'tip';
  sheet: string;
  sheetId: string;
  a1?: string;
  r?: number;
  c?: number;
  message: string;
  fix?: string;
}
const KIND_FIX: Record<Issue['kind'], string> = {
  contrast: 'Use a darker text colour or a lighter fill (aim for 4.5:1).',
  merged: 'Avoid merged cells: screen readers lose their place. Use Centre across selection instead.',
  sheetname: 'Give the sheet a descriptive name.',
  tinyfont: 'Use at least 10 pt for body text.',
  linktext: 'Use meaningful link text instead of the address.',
  empty: 'Delete the sheet or add content.',
  noheader: 'Put column headings in the first row.',
  colorfill: 'Don’t use colour alone to mean something; add a word or symbol.',
};
const MAX_REPORT = 200;
export function checkAccessibility(
  snap: Snap,
  opts: { links?: Array<{ sheetId: string; row: number; col: number; text: string; url: string }> } = {},
): Issue[] {
  const out: Issue[] = [];
  let n = 0;
  const add = (i: Omit<Issue, 'id' | 'fix'>) => {
    if (out.length < MAX_REPORT) out.push({ ...i, id: 'i' + n++, fix: KIND_FIX[i.kind] });
  };
  const sheets = orderedSheets(snap);
  for (const sh of sheets) {
    const ext = usedExtent(sh);
    const has = ext.r >= 0 && ext.c >= 0 && Object.keys(sh.cellData ?? {}).length > 0;
    if (/^(sheet|page|tab)\s?\d*$/i.test(sh.name.trim()))
      add({
        kind: 'sheetname',
        severity: 'tip',
        sheet: sh.name,
        sheetId: sh.id,
        message: `Sheet is named “${sh.name}”.`,
      });
    if (!has) {
      add({ kind: 'empty', severity: 'tip', sheet: sh.name, sheetId: sh.id, message: 'Sheet is empty.' });
      continue;
    }
    for (const m of sh.mergeData ?? [])
      add({
        kind: 'merged',
        severity: 'warning',
        sheet: sh.name,
        sheetId: sh.id,
        a1: a1(m.startRow, m.startColumn),
        r: m.startRow,
        c: m.startColumn,
        message: `Merged cells ${a1(m.startRow, m.startColumn)}:${a1(m.endRow, m.endColumn)}.`,
      });
    // header row: first used row should be mostly text when the sheet has several data rows
    const rows = Object.keys(sh.cellData ?? {})
      .map(Number)
      .sort((x, y) => x - y);
    const top = rows[0];
    const topRow = sh.cellData![String(top)] ?? {};
    const topVals = Object.values(topRow)
      .map(cellValue)
      .filter((v) => v !== null);
    if (rows.length >= 5 && topVals.length >= 2 && topVals.every((v) => typeof v === 'number'))
      add({
        kind: 'noheader',
        severity: 'warning',
        sheet: sh.name,
        sheetId: sh.id,
        a1: a1(top, 0),
        r: top,
        c: 0,
        message: 'The first row is all numbers, so columns have no headings.',
      });
    const seenFill = new Map<string, number>();
    for (const [r, row] of Object.entries(sh.cellData ?? {}))
      for (const [c, cell] of Object.entries(row)) {
        const st = styleOf(snap, cell);
        const v = cellValue(cell);
        if (v === null || v === '') {
          if (st.bg?.rgb) seenFill.set(st.bg.rgb, (seenFill.get(st.bg.rgb) ?? 0) + 1);
          continue;
        }
        const fg = st.cl?.rgb ?? '#000000',
          bg = st.bg?.rgb ?? '#ffffff';
        const ratio = contrastRatio(fg, bg);
        const size = st.fs ?? 11;
        if (ratio !== null && !meetsAA(ratio, size, !!st.bl))
          add({
            kind: 'contrast',
            severity: 'error',
            sheet: sh.name,
            sheetId: sh.id,
            a1: a1(+r, +c),
            r: +r,
            c: +c,
            message: `Text contrast is ${ratio}:1 (${fg} on ${bg}).`,
          });
        if (size < 9)
          add({
            kind: 'tinyfont',
            severity: 'warning',
            sheet: sh.name,
            sheetId: sh.id,
            a1: a1(+r, +c),
            r: +r,
            c: +c,
            message: `Font size ${size} pt is very small.`,
          });
      }
    void seenFill;
  }
  for (const l of opts.links ?? []) {
    const sh = sheets.find((s) => s.id === l.sheetId);
    const t = l.text.trim();
    if (sh && (t === '' || t === l.url || /^https?:\/\//i.test(t)))
      add({
        kind: 'linktext',
        severity: 'warning',
        sheet: sh.name,
        sheetId: sh.id,
        a1: a1(l.row, l.col),
        r: l.row,
        c: l.col,
        message: t ? 'Link text is the web address itself.' : 'Link has no text.',
      });
  }
  const rank = { error: 0, warning: 1, tip: 2 } as const;
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}
export const issueSummary = (l: Issue[]) => ({
  error: l.filter((i) => i.severity === 'error').length,
  warning: l.filter((i) => i.severity === 'warning').length,
  tip: l.filter((i) => i.severity === 'tip').length,
});
export const SHORTCUT_HINTS: Array<[string, string]> = [
  ['Arrow keys', 'Move between cells'],
  ['Ctrl+Arrow', 'Jump to the edge of data'],
  ['Ctrl+Space / Shift+Space', 'Select column / row'],
  ['F2', 'Edit the cell'],
  ['Enter / Tab', 'Confirm and move down / right'],
  ['Esc', 'Cancel an edit or close a dialog'],
  ['Ctrl+/', 'Open the command palette'],
  ['Shift+F10', 'Context menu'],
];

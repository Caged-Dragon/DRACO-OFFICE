// Extra Excel commands (clipboard, fonts, colours, borders, alignment, number formats, cells, sheets, view).
// Every entry is registered in the command registry, so the palette, shortcuts and ribbon all share it.
import type { Engine } from '../core/engine';
import { changeIndent } from '../core/indent';

type AddFn = (
  id: string,
  title: string,
  group: string,
  run: () => unknown | Promise<unknown>,
  keywords?: string,
) => void;
interface Ctx {
  add: AddFn;
  eng: () => Engine | null;
  open: (dialog: string) => void;
}

export const COLORS: [string, string][] = [
  ['red', '#e03131'],
  ['orange', '#f08c00'],
  ['yellow', '#fcc419'],
  ['green', '#2f9e44'],
  ['blue', '#1971c2'],
  ['purple', '#7048e8'],
  ['gray', '#868e96'],
  ['black', '#000000'],
  ['white', '#ffffff'],
];
export const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
export const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

/** Increase or decrease the number of decimals in a number-format pattern. */
export function adjustDecimals(pattern: string | undefined, delta: 1 | -1): string {
  const p = !pattern || /^general$/i.test(pattern) ? '0' : pattern;
  const m = /^(.*?)(\.(0+))?([^0#.]*)$/.exec(p.replace(/_\)|\)/g, '')) ?? [];
  const head = m[1] ?? p;
  const dec = (m[3] ?? '').length;
  const tail = m[4] ?? '';
  const n = Math.max(0, Math.min(15, dec + delta));
  return `${head}${n ? '.' + '0'.repeat(n) : ''}${tail}`;
}

export function registerExtra({ add, eng, open }: Ctx): void {
  const api = () => eng()?.api;
  const wb = () => api()?.getActiveWorkbook() ?? null;
  const ws = () => wb()?.getActiveSheet() ?? null;
  const sel = () => wb()?.getActiveRange() ?? null;
  const cmd = (id: string) => () => void api()?.executeCommand(id);
  type Enm = {
    BorderType: Record<string, never>;
    BorderStyleTypes: Record<string, never>;
    WrapStrategy: Record<string, never>;
    Dimension: Record<string, never>;
  };
  const en = () => api()!.Enum as unknown as Enm;

  /* ---- Clipboard ---- */
  add('edit.cut', 'Cut', 'Clipboard', cmd('univer.command.cut'), 'clipboard');
  add('edit.copy', 'Copy', 'Clipboard', cmd('univer.command.copy'), 'clipboard');
  add('edit.paste', 'Paste', 'Clipboard', cmd('univer.command.paste'), 'clipboard');
  add('edit.paste.values', 'Paste values only', 'Clipboard', cmd('sheet.command.paste-value'), 'special');
  add('edit.paste.formulas', 'Paste formulas only', 'Clipboard', cmd('sheet.command.paste-formula'), 'special');
  add('edit.paste.format', 'Paste formatting only', 'Clipboard', cmd('sheet.command.paste-format'), 'special');
  add('edit.paste.widths', 'Paste column widths', 'Clipboard', cmd('sheet.command.paste-col-width'), 'special');
  add('edit.paste.noborder', 'Paste except borders', 'Clipboard', cmd('sheet.command.paste-besides-border'), 'special');
  add(
    'edit.painter',
    'Format painter (once)',
    'Clipboard',
    cmd('sheet.command.set-once-format-painter'),
    'brush copy format',
  );
  add('edit.painter.multi', 'Format painter (keep on)', 'Clipboard', cmd('sheet.command.set-infinite-format-painter'));

  /* ---- Find, select ---- */
  add('edit.find', 'Find', 'Editing', () => open('find'), 'search ctrl+f');
  add('edit.replace', 'Replace', 'Editing', () => open('replace'), 'search ctrl+h');
  add('edit.selectall', 'Select all cells', 'Editing', () => {
    const w = ws();
    if (w) w.getRange(0, 0, w.getMaxRows(), w.getMaxColumns()).activate();
  });
  add('insert.hyperlink', 'Insert hyperlink', 'Insert', cmd('sheet.operation.insert-hyper-link'), 'link url');

  /* ---- Font: family, size, colour ---- */
  for (const f of FONTS)
    add(`fmt.font.${f.toLowerCase().replace(/ /g, '-')}`, `Font: ${f}`, 'Format', () => sel()?.setFontFamily(f));
  for (const n of SIZES) add(`fmt.size.${n}`, `Font size ${n}`, 'Format', () => sel()?.setFontSize(n));
  for (const [n, hex] of COLORS) {
    add(`fmt.color.${n}`, `Font colour: ${n}`, 'Format', () => sel()?.setFontColor(hex));
    add(`fmt.fill.${n}`, `Fill colour: ${n}`, 'Format', () => sel()?.setBackground(hex));
  }
  add('fmt.fill.none', 'No fill', 'Format', () => sel()?.setBackground(''));
  add('fmt.color.auto', 'Automatic font colour', 'Format', () => sel()?.setFontColor(''));
  add('fmt.underline.double', 'Double underline', 'Format', () => sel()?.setFontLine('underline'));

  /* ---- Borders ---- */
  const border =
    (t: string, style = 'THIN') =>
    () => {
      const e = en();
      sel()?.setBorder(e.BorderType[t], e.BorderStyleTypes[style], '#000000');
    };
  add('fmt.border.all', 'Borders: all', 'Format', border('ALL'));
  add('fmt.border.outside', 'Borders: outside', 'Format', border('OUTSIDE'));
  add('fmt.border.thick', 'Borders: thick outside', 'Format', border('OUTSIDE', 'THICK'));
  add('fmt.border.bottom', 'Borders: bottom', 'Format', border('BOTTOM'));
  add('fmt.border.top', 'Borders: top', 'Format', border('TOP'));
  add('fmt.border.left', 'Borders: left', 'Format', border('LEFT'));
  add('fmt.border.right', 'Borders: right', 'Format', border('RIGHT'));
  add('fmt.border.double', 'Borders: double bottom', 'Format', border('BOTTOM', 'DOUBLE'));
  add('fmt.border.none', 'Borders: none', 'Format', () => {
    const e = en();
    sel()?.setBorder(e.BorderType.ALL, e.BorderStyleTypes.NONE);
  });

  /* ---- Alignment ---- */
  add('fmt.valign.top', 'Align top', 'Format', () => sel()?.setVerticalAlignment('top'));
  add('fmt.valign.middle', 'Align middle', 'Format', () => sel()?.setVerticalAlignment('middle'));
  add('fmt.valign.bottom', 'Align bottom', 'Format', () => sel()?.setVerticalAlignment('bottom'));
  for (const [n, deg, t] of [
    ['up', 45, 'Angle counterclockwise'],
    ['down', -45, 'Angle clockwise'],
    ['vertical', 90, 'Rotate text up'],
    ['vertdown', -90, 'Rotate text down'],
    ['none', 0, 'Horizontal text'],
  ] as [string, number, string][])
    add(`fmt.rotate.${n}`, t, 'Format', () => sel()?.setTextRotation(deg));
  add('fmt.shrink', 'Shrink to fit', 'Format', () => sel()?.setShrinkToFit(true));
  add('fmt.merge.across', 'Merge across', 'Format', () => sel()?.mergeAcross());
  add('fmt.merge.down', 'Merge down', 'Format', () => sel()?.mergeVertically());
  add('fmt.overflow', 'Text overflow (no wrap)', 'Format', () => sel()?.setWrapStrategy(en().WrapStrategy.OVERFLOW));

  add('fmt.indent.more', 'Increase indent', 'Format', () => {
    const e = eng();
    if (e) return changeIndent(e, 1);
  });
  add('fmt.indent.less', 'Decrease indent', 'Format', () => {
    const e = eng();
    if (e) return changeIndent(e, -1);
  });

  add('fmt.mergecenter', 'Merge and centre', 'Format', () => {
    const r = sel();
    if (!r) return;
    r.merge();
    r.setHorizontalAlignment('center');
  });
  add('edit.undo', 'Undo', 'Editing', cmd('univer.command.undo'), 'ctrl+z');
  add('edit.redo', 'Redo', 'Editing', cmd('univer.command.redo'), 'ctrl+y');

  /* ---- Number formats ---- */
  const nf = (id: string, title: string, p: string, kw = '') =>
    add(id, title, 'Format', () => sel()?.setNumberFormat(p), kw);
  nf('fmt.comma', 'Comma style', '#,##0.00', 'thousands');
  nf('fmt.accounting', 'Accounting format', '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)', 'money');
  nf('fmt.text', 'Text format', '@');
  nf('fmt.fraction', 'Fraction', '# ?/?');
  nf('fmt.datelong', 'Long date', 'dddd, mmmm d, yyyy');
  nf('fmt.dateiso', 'Date yyyy-mm-dd', 'yyyy-mm-dd');
  nf('fmt.timelong', 'Time with seconds', 'h:mm:ss AM/PM');
  nf('fmt.percent2', 'Percent with 2 decimals', '0.00%');
  nf('fmt.int', 'Whole number', '0');
  for (const [k, sym, name] of [
    ['inr', '₹', 'Indian rupee'],
    ['usd', '$', 'US dollar'],
    ['eur', '€', 'Euro'],
    ['gbp', '£', 'British pound'],
    ['jpy', '¥', 'Japanese yen'],
  ] as const)
    nf(`fmt.cur.${k}`, `Currency: ${name} (${sym})`, `"${sym}"#,##0.00`, 'money');
  const dec = (d: 1 | -1) => () => {
    const r = sel();
    if (r)
      r.setNumberFormat(
        adjustDecimals((r as unknown as { getNumberFormat?: () => string }).getNumberFormat?.() ?? '0', d),
      );
  };
  add('fmt.dec.more', 'Increase decimal', 'Format', dec(1), 'decimals');
  add('fmt.dec.less', 'Decrease decimal', 'Format', dec(-1), 'decimals');

  /* ---- Cells: insert/delete shifting, size ---- */
  add('cell.insert.right', 'Insert cells, shift right', 'Cells', () => sel()?.insertCells(en().Dimension.COLUMNS));
  add('cell.insert.down', 'Insert cells, shift down', 'Cells', () => sel()?.insertCells(en().Dimension.ROWS));
  add('cell.delete.left', 'Delete cells, shift left', 'Cells', () => sel()?.deleteCells(en().Dimension.COLUMNS));
  add('cell.delete.up', 'Delete cells, shift up', 'Cells', () => sel()?.deleteCells(en().Dimension.ROWS));
  for (const h of [15, 20, 30, 45])
    add(`row.height.${h}`, `Row height ${h}`, 'Cells', () => {
      const r = sel(),
        w = ws();
      if (r && w) for (let i = r.getRow(); i <= r.getLastRow(); i++) w.setRowHeight(i, h);
    });
  for (const wd of [64, 100, 150, 220])
    add(`col.width.${wd}`, `Column width ${wd}`, 'Cells', () => {
      const r = sel(),
        w = ws();
      if (r && w) for (let i = r.getColumn(); i <= r.getLastColumn(); i++) w.setColumnWidth(i, wd);
    });
  add('row.autofit', 'AutoFit row height', 'Cells', () => {
    const r = sel(),
      w = ws();
    if (r && w) for (let i = r.getRow(); i <= r.getLastRow(); i++) w.autoFitRow(i);
  });
  add('col.autofit', 'AutoFit column width', 'Cells', () => {
    const r = sel(),
      w = ws();
    if (!r || !w) return;
    for (let c = r.getColumn(); c <= r.getLastColumn(); c++) {
      let max = 4;
      const rows = Math.min(w.getLastRow() + 1, 2000);
      for (let i = 0; i < rows; i++) max = Math.max(max, String(w.getRange(i, c).getDisplayValue() ?? '').length);
      w.setColumnWidth(c, Math.min(420, Math.round(max * 8 + 18)));
    }
  });

  /* ---- Sheets ---- */
  const move = (d: number) => () => {
    const b = wb(),
      s = ws();
    if (!b || !s) return;
    const i = b.getSheets().findIndex((x) => x.getSheetId() === s.getSheetId());
    const j = Math.max(0, Math.min(b.getSheets().length - 1, i + d));
    if (j !== i) b.moveSheet(s, j);
  };
  add('sheet.moveleft', 'Move sheet left', 'Sheets', move(-1));
  add('sheet.moveright', 'Move sheet right', 'Sheets', move(1));
  add('sheet.rename', 'Rename sheet', 'Sheets', () => {
    const s = ws();
    if (!s) return;
    const n = window.prompt('Sheet name', s.getSheetName());
    if (n?.trim()) s.setName(n.trim().slice(0, 31));
  });
  for (const [n, hex] of COLORS) add(`sheet.tab.${n}`, `Tab colour: ${n}`, 'Sheets', () => ws()?.setTabColor(hex));
  add('sheet.tab.none', 'No tab colour', 'Sheets', () => ws()?.setTabColor(''));
  add('sheet.unhide', 'Unhide all sheets', 'Sheets', () => {
    for (const s of wb()?.getSheets() ?? [])
      if ((s as unknown as { isSheetHidden?: () => boolean }).isSheetHidden?.()) s.showSheet();
  });

  /* ---- View ---- */
  add(
    'view.fullscreen',
    'Full screen',
    'View',
    () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    },
    'maximize',
  );
}

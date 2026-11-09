// v99 glue: the command registry (palette + shortcuts) over the engine API.
import type { Engine } from '../core/engine';
import { registerExtra } from './extraCmds';
import { registerInsert } from './insertCmds';
import { registerGap } from './gapCmds';
import { search, pushRecent, parseKeys, matches, keysFor, type Cmd, type KeySpec } from './commands';
export interface AppApi {
  open(dialog: string, tab?: string): void;
  save(): void;
  print(): void;
  palette(): void;
  help(): void;
}
interface Impl extends Cmd {
  run: () => unknown | Promise<unknown>;
  when?: () => boolean;
}
type R = ReturnType<NonNullable<ReturnType<Engine['api']['getActiveWorkbook']>>['getActiveRange']>;
let eng: Engine | null = null;
let app: AppApi | null = null;
let cmds: Impl[] = [];
let recent: string[] = (() => {
  try {
    return JSON.parse(localStorage.getItem('draco:recent-cmds') ?? '[]') as string[];
  } catch {
    return [];
  }
})();
const wb = () => eng?.api.getActiveWorkbook() ?? null;
const ws = () => wb()?.getActiveSheet() ?? null;
const sel = (): NonNullable<R> | null => (wb()?.getActiveRange() ?? null) as NonNullable<R> | null;
const styleOf = (rg: NonNullable<R>) => {
  const c = rg.getCellStyles()?.[0]?.[0] as unknown as
    ({ _style?: Record<string, unknown> } & Record<string, unknown>) | undefined;
  return (c?._style ?? c ?? {}) as {
    bl?: number;
    it?: number;
    ul?: { s?: number };
    st?: { s?: number };
    fs?: number;
    tb?: number;
  };
};
const toggle =
  (get: (s: ReturnType<typeof styleOf>) => boolean, set: (rg: NonNullable<R>, on: boolean) => void) => () => {
    const rg = sel();
    if (!rg) return;
    set(rg, !get(styleOf(rg)));
  };
const serialNow = () => Date.now() / 86400000 + 25569 - new Date().getTimezoneOffset() / 1440;
const fmt = (p: string) => () => {
  sel()?.setNumberFormat(p);
};
function fillDir(dir: 'down' | 'right') {
  const w = ws(),
    rg = sel();
  if (!w || !rg) return;
  const r0 = rg.getRow(),
    c0 = rg.getColumn(),
    r1 = rg.getLastRow(),
    c1 = rg.getLastColumn();
  const multi = dir === 'down' ? r1 > r0 : c1 > c0;
  if (multi) {
    const src = dir === 'down' ? w.getRange(r0, c0, 1, c1 - c0 + 1) : w.getRange(r0, c0, r1 - r0 + 1, 1);
    void src.autoFill(rg, 'COPY' as never);
    return;
  }
  if (dir === 'down' && r0 > 0) {
    const both = w.getRange(r0 - 1, c0, 2, c1 - c0 + 1);
    void w.getRange(r0 - 1, c0, 1, c1 - c0 + 1).autoFill(both, 'COPY' as never);
  } else if (dir === 'right' && c0 > 0) {
    const both = w.getRange(r0, c0 - 1, r1 - r0 + 1, 2);
    void w.getRange(r0, c0 - 1, r1 - r0 + 1, 1).autoFill(both, 'COPY' as never);
  }
}
function autosum() {
  const w = ws(),
    rg = sel();
  if (!w || !rg) return;
  const r = rg.getRow(),
    c = rg.getColumn();
  const num = (rr: number, cc: number) => typeof w.getRange(rr, cc).getValue() === 'number';
  let top = r - 1;
  while (top >= 0 && num(top, c)) top--;
  if (top < r - 1) {
    w.getRange(r, c).setFormula(
      `=SUM(${w.getRange(top + 1, c).getA1Notation()}:${w.getRange(r - 1, c).getA1Notation()})`,
    );
    return;
  }
  let left = c - 1;
  while (left >= 0 && num(r, left)) left--;
  if (left < c - 1) {
    w.getRange(r, c).setFormula(
      `=SUM(${w.getRange(r, left + 1).getA1Notation()}:${w.getRange(r, c - 1).getA1Notation()})`,
    );
    return;
  }
  w.getRange(r, c).setFormula('=SUM()');
}
const sheetMove = (d: number) => () => {
  const b = wb();
  if (!b) return;
  const all = b.getSheets().filter((s) => !(s as unknown as { isSheetHidden(): boolean }).isSheetHidden?.());
  const i = all.findIndex((s) => s.getSheetId() === b.getActiveSheet().getSheetId());
  const t = all[(i + d + all.length) % all.length];
  if (t) b.setActiveSheet(t);
};
function build(): Impl[] {
  const A = () => app!;
  const L: Impl[] = [];
  const add = (id: string, title: string, group: string, run: Impl['run'], keywords = '') => {
    L.push({ id, title, group, run, keywords, keys: keysFor(id) });
  };
  add(
    'fmt.bold',
    'Bold',
    'Format',
    toggle(
      (s) => !!s.bl,
      (r, on) => r.setFontWeight(on ? 'bold' : 'normal'),
    ),
    'strong',
  );
  add(
    'fmt.italic',
    'Italic',
    'Format',
    toggle(
      (s) => !!s.it,
      (r, on) => r.setFontStyle(on ? 'italic' : 'normal'),
    ),
    'slant',
  );
  add(
    'fmt.underline',
    'Underline',
    'Format',
    toggle(
      (s) => !!s.ul?.s,
      (r, on) => r.setFontLine(on ? 'underline' : 'none'),
    ),
  );
  add(
    'fmt.strike',
    'Strikethrough',
    'Format',
    toggle(
      (s) => !!s.st?.s,
      (r, on) => r.setFontLine(on ? 'line-through' : 'none'),
    ),
    'cross out',
  );
  add(
    'fmt.wrap',
    'Wrap text',
    'Format',
    toggle(
      (s) => s.tb === 3,
      (r, on) => r.setWrap(on),
    ),
  );
  add('fmt.left', 'Align left', 'Format', () => sel()?.setHorizontalAlignment('left'));
  add('fmt.center', 'Align centre', 'Format', () => sel()?.setHorizontalAlignment('center'), 'center');
  add('fmt.right', 'Align right', 'Format', () => sel()?.setHorizontalAlignment('normal'));
  add('fmt.general', 'Number format: General', 'Format', fmt('General'));
  add('fmt.number', 'Number format: Number with thousands separator', 'Format', fmt('#,##0.00'));
  add('fmt.currency', 'Number format: Currency', 'Format', fmt('"$"#,##0.00'), 'money dollar');
  add('fmt.percent', 'Number format: Percent', 'Format', fmt('0.00%'));
  add('fmt.date', 'Number format: Date', 'Format', fmt('yyyy-mm-dd'));
  add('fmt.time', 'Number format: Time', 'Format', fmt('hh:mm:ss'));
  add('fmt.sci', 'Number format: Scientific', 'Format', fmt('0.00E+00'));
  add('fmt.clear', 'Clear formatting', 'Format', () => sel()?.clearFormat());
  add('fmt.merge', 'Merge cells', 'Format', () => sel()?.merge());
  add('fmt.unmerge', 'Unmerge cells', 'Format', () => sel()?.breakApart());
  add('fmt.fsup', 'Increase font size', 'Format', () => {
    const r = sel();
    if (r) r.setFontSize((styleOf(r).fs ?? 11) + 1);
  });
  add('fmt.fsdown', 'Decrease font size', 'Format', () => {
    const r = sel();
    if (r) r.setFontSize(Math.max(6, (styleOf(r).fs ?? 11) - 1));
  });
  add('edit.filldown', 'Fill down', 'Edit', () => fillDir('down'), 'copy above');
  add('edit.fillright', 'Fill right', 'Edit', () => fillDir('right'));
  add(
    'edit.today',
    'Insert today’s date',
    'Edit',
    () => {
      const r = sel();
      if (r) {
        r.setValue(Math.floor(serialNow()));
        r.setNumberFormat('yyyy-mm-dd');
      }
    },
    'current date',
  );
  add(
    'edit.now',
    'Insert the current time',
    'Edit',
    () => {
      const r = sel();
      if (r) {
        r.setValue(serialNow() % 1);
        r.setNumberFormat('hh:mm:ss');
      }
    },
    'time now',
  );
  add('edit.autosum', 'AutoSum', 'Edit', autosum, 'total add');
  add('edit.clearc', 'Clear contents', 'Edit', () => sel()?.clearContent(), 'delete');
  add('edit.clearall', 'Clear all', 'Edit', () => sel()?.clear());
  add('row.above', 'Insert row above', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.insertRowsBefore(r.getRow(), r.getLastRow() - r.getRow() + 1);
  });
  add('row.below', 'Insert row below', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.insertRowsAfter(r.getLastRow(), r.getLastRow() - r.getRow() + 1);
  });
  add('col.left', 'Insert column left', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.insertColumnsBefore(r.getColumn(), r.getLastColumn() - r.getColumn() + 1);
  });
  add('col.right', 'Insert column right', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.insertColumnsAfter(r.getLastColumn(), r.getLastColumn() - r.getColumn() + 1);
  });
  add('row.delete', 'Delete rows', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.deleteRows(r.getRow(), r.getLastRow() - r.getRow() + 1);
  });
  add('col.delete', 'Delete columns', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.deleteColumns(r.getColumn(), r.getLastColumn() - r.getColumn() + 1);
  });
  add('row.hide', 'Hide rows', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.hideRows(r.getRow(), r.getLastRow() - r.getRow() + 1);
  });
  add('col.hide', 'Hide columns', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.hideColumns(r.getColumn(), r.getLastColumn() - r.getColumn() + 1);
  });
  add('row.show', 'Unhide rows', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.showRows(Math.max(0, r.getRow() - 1), r.getLastRow() - r.getRow() + 3);
  });
  add('col.show', 'Unhide columns', 'Rows & columns', () => {
    const r = sel(),
      w = ws();
    if (r && w) w.showColumns(Math.max(0, r.getColumn() - 1), r.getLastColumn() - r.getColumn() + 3);
  });
  add('view.freezerow', 'Freeze top row', 'View', () => ws()?.setFrozenRows(1), 'pane lock');
  add('view.freezecol', 'Freeze first column', 'View', () => ws()?.setFrozenColumns(1), 'pane lock');
  add(
    'view.freezesel',
    'Freeze panes at selection',
    'View',
    () => {
      const r = sel(),
        w = ws();
      if (r && w) {
        w.setFrozenRows(r.getRow());
        w.setFrozenColumns(r.getColumn());
      }
    },
    'pane lock',
  );
  add('view.unfreeze', 'Unfreeze panes', 'View', () => {
    ws()?.setFrozenRows(0);
    ws()?.setFrozenColumns(0);
  });
  add('view.grid', 'Show or hide gridlines', 'View', () => {
    const w = ws();
    if (w) w.setHiddenGridlines(!w.hasHiddenGridLines());
  });
  add(
    'sheet.new',
    'New sheet',
    'Sheet',
    () => {
      const b = wb();
      if (b) {
        const s = b.insertSheet();
        b.setActiveSheet(s);
      }
    },
    'add tab',
  );
  add('sheet.dup', 'Duplicate sheet', 'Sheet', () => {
    const b = wb(),
      w = ws();
    if (b && w) b.duplicateSheet(w);
  });
  add('sheet.delete', 'Delete sheet', 'Sheet', () => {
    const b = wb(),
      w = ws();
    if (b && w && b.getSheets().length > 1 && confirm(`Delete “${w.getSheetName()}”?`)) b.deleteSheet(w);
  });
  add('sheet.hide', 'Hide sheet', 'Sheet', () => {
    const b = wb(),
      w = ws();
    if (b && w && b.getSheets().length > 1) w.hideSheet();
  });
  add('sheet.next', 'Next sheet', 'Sheet', sheetMove(1));
  add('sheet.prev', 'Previous sheet', 'Sheet', sheetMove(-1));
  add(
    'data.sortaz',
    'Sort A to Z',
    'Data',
    () => {
      (sel() as unknown as { sort(o: object): unknown } | null)?.sort({ column: sel()!.getColumn(), ascending: true });
    },
    'ascending',
  );
  add(
    'data.sortza',
    'Sort Z to A',
    'Data',
    () => {
      (sel() as unknown as { sort(o: object): unknown } | null)?.sort({ column: sel()!.getColumn(), ascending: false });
    },
    'descending',
  );
  add(
    'data.filter',
    'Turn filter on or off',
    'Data',
    () => {
      const w = ws();
      if (!w) return;
      const f = (w as unknown as { getFilter(): { remove(): void } | null }).getFilter();
      if (f) f.remove();
      else (w.getDataRange() as unknown as { createFilter(): unknown }).createFilter();
    },
    'autofilter',
  );
  const dlg = (id: string, title: string, d: string, tab?: string, kw = '') =>
    add(id, title, 'Open', () => A().open(d, tab), kw);
  dlg('open.formulas.evaluate', 'Evaluate formula', 'formulas', 'evaluate', 'step through');
  dlg('open.formulas.errors', 'Error checking', 'formulas', 'errors', 'errors #REF');
  dlg('open.formulas.watch', 'Watch window', 'formulas', 'watch', 'watch cells');
  dlg('open.formulas.calc', 'Calculation options', 'formulas', 'calc', 'manual automatic');
  dlg('open.data.dupes', 'Remove duplicates', 'data', 'dupes', 'duplicates');
  dlg('open.data.text', 'Text to columns', 'data', 'text', 'split delimiter');
  dlg('open.data.flash', 'Flash Fill', 'data', 'flash', 'pattern');
  dlg('open.data.adv', 'Advanced filter', 'data', 'adv', 'criteria');
  dlg('open.data.subtotal', 'Subtotal', 'data', 'subtotal', 'group');
  dlg('open.data.whatif', 'What-if analysis', 'data', 'whatif', 'goal seek scenario data table');
  dlg('open.data.consol', 'Consolidate', 'data', 'consol', 'merge ranges');
  dlg('open.files', 'Files: import / export', 'files', undefined, 'csv xlsx open download');
  dlg('open.print', 'Print and PDF', 'print', undefined, 'page setup');
  dlg('open.versions', 'Version history', 'files', 'versions', 'restore');
  dlg('open.charts', 'Charts', 'charts', undefined, 'graph plot');
  dlg('open.objects', 'Objects: sparklines, shapes, pictures', 'objects');
  dlg('open.pivot', 'PivotTable', 'pivot', undefined, 'summarize group');
  dlg('open.query', 'Queries (Power Query)', 'query', undefined, 'transform import');
  dlg('open.data', 'Data tools', 'data', undefined, 'duplicates go to special flash fill');
  dlg('open.formulas', 'Formulas: names, auditing, error checking', 'formulas');
  dlg('open.styles', 'Cell styles', 'styles');
  dlg('open.comments', 'Comments', 'review', 'comments', 'review thread');
  dlg('open.notes', 'Notes', 'review', 'notes');
  dlg('open.share', 'Share and live co-editing', 'review', 'share', 'collaborate invite');
  dlg('open.changes', 'Track changes', 'review', 'changes', 'history log');
  dlg('open.protect', 'Protect sheet or workbook', 'review', 'protect', 'lock password');
  dlg('open.macros', 'Macros', 'tools', 'macros', 'record automate');
  dlg('open.scripts', 'Scripts', 'tools', 'scripts', 'javascript automate code');
  dlg('open.links', 'Links and web data', 'tools', 'links', 'hyperlink url');
  dlg('open.access', 'Accessibility', 'tools', 'access', 'contrast screen reader');
  dlg('open.perf', 'Performance and large data', 'tools', 'perf', 'million rows benchmark');
  dlg('open.lang', 'Language and regional formats', 'tools', 'lang', 'rtl locale currency');
  dlg('open.tables', 'Tables', 'tools', 'tables', 'table structured reference total row slicer');
  dlg(
    'open.analysis',
    'Analysis ToolPak',
    'tools',
    'analysis',
    'statistics regression anova t-test correlation descriptive',
  );
  dlg('open.templates', 'Templates, themes and assistant', 'tools', 'templates', 'gallery new');
  dlg('open.shortcuts', 'Keyboard shortcuts', 'tools', 'keys', 'help keys');
  dlg('open.parity', 'Parity report', 'tools', 'parity', 'roadmap progress');
  const zm = (f: (z: number) => number) => () => {
    const w = ws() as unknown as { zoom?: (n: number) => void; getZoom?: () => number } | null;
    if (!w?.zoom) return;
    const z = w.getZoom?.() ?? 1;
    w.zoom(Math.min(4, Math.max(0.1, +f(z).toFixed(2))));
  };
  add(
    'view.zoomin',
    'Zoom in',
    'View',
    zm((z) => z + 0.1),
  );
  add(
    'view.zoomout',
    'Zoom out',
    'View',
    zm((z) => z - 0.1),
  );
  for (const pct of [50, 75, 100, 150, 200])
    add(
      `view.zoom${pct}`,
      `Zoom ${pct}%`,
      'View',
      zm(() => pct / 100),
    );
  let hdr = true;
  add('view.headings', 'Show or hide row and column headings', 'View', () => {
    const w = ws() as unknown as { setRowHeaderWidth(n: number): void; setColumnHeaderHeight(n: number): void } | null;
    if (!w) return;
    hdr = !hdr;
    w.setRowHeaderWidth(hdr ? 46 : 0);
    w.setColumnHeaderHeight(hdr ? 20 : 0);
  });
  registerExtra({ add, eng: () => eng, open: (d) => A().open(d) });
  registerInsert(add, () => eng);
  registerGap(add, () => eng);
  add('app.save', 'Save now', 'Workbook', () => A().save());
  add('app.print', 'Print', 'Workbook', () => A().print());
  add('view.palette', 'Command palette', 'Workbook', () => A().palette());
  return L;
}
export const list = (): Cmd[] => cmds.map(({ run: _r, when: _w, ...c }) => c);
void 0;
export const query = (q: string, limit = 30): Cmd[] => search(list(), q, recent, limit);
export async function run(id: string): Promise<boolean> {
  const c = cmds.find((x) => x.id === id);
  if (!c) return false;
  recent = pushRecent(recent, id);
  try {
    localStorage.setItem('draco:recent-cmds', JSON.stringify(recent));
  } catch {
    /* blocked */
  }
  await c.run();
  return true;
}
const KEYMAP: Array<[KeySpec, string]> = [
  ['Ctrl+F', 'edit.find'],
  ['Ctrl+H', 'edit.replace'],
  ['Ctrl+D', 'edit.filldown'],
  ['Ctrl+R', 'edit.fillright'],
  ['Ctrl+;', 'edit.today'],
  ['Ctrl+Shift+;', 'edit.now'],
  ['Alt+=', 'edit.autosum'],
  ['Ctrl+5', 'fmt.strike'],
  ['Ctrl+Shift+~', 'fmt.general'],
  ['Ctrl+Shift+!', 'fmt.number'],
  ['Ctrl+Shift+$', 'fmt.currency'],
  ['Ctrl+Shift+%', 'fmt.percent'],
  ['Ctrl+Shift+#', 'fmt.date'],
  ['Ctrl+9', 'row.hide'],
  ['Ctrl+0', 'col.hide'],
  ['Ctrl+Shift+9', 'row.show'],
  ['Ctrl+Shift+0', 'col.show'],
  ['Ctrl+Shift+L', 'data.filter'],
  ['Shift+F11', 'sheet.new'],
  ['Ctrl+PageDown', 'sheet.next'],
  ['Ctrl+PageUp', 'sheet.prev'],
  ['Ctrl+/', 'view.palette'],
  ['Alt+Q', 'view.palette'],
  ['F1', 'open.shortcuts'],
].map(([k, id]) => [parseKeys(k as string), id as string]);
const CONFLICT_SKIP = new Set(['F1']);
void CONFLICT_SKIP;
/** Is the user typing in a text field / the cell editor (where these shortcuts must not fire)? */
let editing = false;
let last = '';
let spurious = false;
let handledAt = -1e9;
let modAt = 0;
let subs: Array<{ dispose(): void }> = [];
function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.closest?.('.dialog,.palette')) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return editing;
  return false;
}
function onKey(e: KeyboardEvent) {
  if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) {
    modAt = performance.now();
    return;
  }
  last = e.key + (e.defaultPrevented ? ' prevented' : '');
  const isPalette = ((e.ctrlKey || e.metaKey) && e.key === '/') || (e.altKey && e.key.toLowerCase() === 'q');
  if (typing(e.target) && !isPalette) {
    last += ' typing';
    return;
  }
  for (const [spec, id] of KEYMAP)
    if (matches(e, spec)) {
      e.preventDefault();
      e.stopPropagation();
      handledAt = performance.now();
      if (spurious) {
        spurious = false;
        try {
          void (wb() as unknown as { abortEditingAsync?: () => unknown } | null)?.abortEditingAsync?.();
        } catch {
          /* not editing */
        }
      }
      void run(id);
      return;
    }
  if (spurious) {
    spurious = false;
    editing = true;
  } // a real key follows the modifier: the editor is genuine
}
export function init(e: Engine) {
  eng = e;
  cmds = build();
  const ev = e.api as unknown as {
    Event: Record<string, string>;
    addEvent(n: string, f: () => void): { dispose(): void };
  };
  try {
    subs = [
      ev.addEvent(ev.Event.SheetEditStarted, () => {
        const t = performance.now();
        if (t - handledAt < 400) {
          editing = false;
          spurious = false;
          try {
            void (wb() as unknown as { abortEditingAsync?: () => unknown } | null)?.abortEditingAsync?.();
          } catch {
            /* not editing */
          }
        } else if (t - modAt < 150) {
          spurious = true;
          editing = false;
        } else editing = true;
      }),
      ev.addEvent(ev.Event.SheetEditEnded, () => {
        editing = false;
        spurious = false;
      }),
    ];
  } catch {
    /* events unavailable */
  }
  window.addEventListener('keydown', onKey, true);
  (window as unknown as Record<string, unknown>).dracoCmd = {
    list,
    query,
    run,
    state: () => ({ editing, spurious, last }),
  };
}
export function setApp(a: AppApi) {
  app = a;
}
export function dispose() {
  for (const x of subs) {
    try {
      x.dispose();
    } catch {
      /* gone */
    }
  }
  subs = [];
  window.removeEventListener('keydown', onKey, true);
  eng = null;
}

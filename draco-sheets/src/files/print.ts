// Print layout engine (v81/v82): page setup -> pages -> drawing ops, rendered to SVG (preview/print) or PDF.
import {
  DEFAULT_COL_PX,
  DEFAULT_ROW_PX,
  cellValue,
  colName,
  parseA1,
  styleOf,
  usedExtent,
  type Cell,
  type SheetSnap,
  type Snap,
  type Style,
} from './model';
import { displayText } from './format';

export type Paper = 'letter' | 'legal' | 'a3' | 'a4' | 'a5' | 'tabloid';
export const PAPER_PT: Record<Paper, [number, number]> = {
  letter: [612, 792],
  legal: [612, 1008],
  a3: [842, 1191],
  a4: [595, 842],
  a5: [420, 595],
  tabloid: [792, 1224],
};
export interface HF {
  l: string;
  c: string;
  r: string;
}
export interface PageSetup {
  orientation: 'portrait' | 'landscape';
  paper: Paper;
  margins: { t: number; b: number; l: number; r: number; header: number; footer: number };
  scale: number;
  fitW: number;
  fitH: number;
  useFit: boolean;
  printArea: string;
  titleRows: string;
  titleCols: string;
  gridlines: boolean;
  headings: boolean;
  centerH: boolean;
  centerV: boolean;
  pageOrder: 'down' | 'over';
  rowBreaks: number[];
  colBreaks: number[];
  header: HF;
  footer: HF;
  blackWhite: boolean;
}
export const defaultSetup = (): PageSetup => ({
  orientation: 'portrait',
  paper: 'letter',
  margins: { t: 0.75, b: 0.75, l: 0.7, r: 0.7, header: 0.3, footer: 0.3 },
  scale: 100,
  fitW: 1,
  fitH: 0,
  useFit: false,
  printArea: '',
  titleRows: '',
  titleCols: '',
  gridlines: false,
  headings: false,
  centerH: false,
  centerV: false,
  pageOrder: 'down',
  rowBreaks: [],
  colBreaks: [],
  header: { l: '', c: '', r: '' },
  footer: { l: '', c: '', r: '' },
  blackWhite: false,
});
export const mergeSetup = (s?: Partial<PageSetup>): PageSetup => {
  const d = defaultSetup();
  return {
    ...d,
    ...(s ?? {}),
    margins: { ...d.margins, ...(s?.margins ?? {}) },
    header: { ...d.header, ...(s?.header ?? {}) },
    footer: { ...d.footer, ...(s?.footer ?? {}) },
  };
};

export interface HFCtx {
  page: number;
  pages: number;
  sheet: string;
  file: string;
  now: Date;
}
export function expandHF(text: string, c: HFCtx): string {
  return text.replace(/&(&|P|N|D|T|F|A|B|I|U|S|X|Y|\d+|"[^"]*"(?:,[^&]*)?)/gi, (_m, k: string) => {
    const u = k.toUpperCase();
    if (k === '&') return '&';
    if (u === 'P') return String(c.page);
    if (u === 'N') return String(c.pages);
    if (u === 'D') return `${c.now.getMonth() + 1}/${c.now.getDate()}/${c.now.getFullYear()}`;
    if (u === 'T') {
      const h = c.now.getHours();
      return `${h % 12 || 12}:${String(c.now.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    }
    if (u === 'F') return c.file;
    if (u === 'A') return c.sheet;
    return '';
  });
}
/** '1:3' / 'A:B' / 'A1:C9' parsing helpers */
export function parseArea(s: string): { r0: number; c0: number; r1: number; c1: number } | null {
  const t = s.trim().replace(/\$/g, '');
  if (!t) return null;
  const parts = t.split(':');
  const p = parseA1(parts[0]);
  const q = parseA1(parts[1] ?? parts[0]);
  if (!p || !q) return null;
  return { r0: Math.min(p.r, q.r), c0: Math.min(p.c, q.c), r1: Math.max(p.r, q.r), c1: Math.max(p.c, q.c) };
}
export function parseTitleRows(s: string): [number, number] | null {
  const m = /^\$?(\d+)(?::\$?(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const a = +m[1] - 1,
    b = +(m[2] ?? m[1]) - 1;
  return a >= 0 && b >= a ? [a, b] : null;
}
export function parseTitleCols(s: string): [number, number] | null {
  const m = /^\$?([A-Za-z]+)(?::\$?([A-Za-z]+))?$/.exec(s.trim());
  if (!m) return null;
  const ci = (x: string) => {
    let n = 0;
    for (const ch of x.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
  };
  const a = ci(m[1]),
    b = ci(m[2] ?? m[1]);
  return b >= a ? [a, b] : null;
}

export interface Page {
  index: number;
  rows: number[];
  cols: number[];
  band: { r: number; c: number };
}
export interface Layout {
  pages: Page[];
  scale: number;
  paper: [number, number];
  content: { x: number; y: number; w: number; h: number };
  area: { r0: number; c0: number; r1: number; c1: number };
  colW: (c: number) => number;
  rowH: (r: number) => number;
  error?: string;
  warnings: string[];
}
const colPt = (sh: SheetSnap, c: number) =>
  (sh.columnData?.[c]?.hd ? 0 : (sh.columnData?.[c]?.w ?? sh.defaultColumnWidth ?? DEFAULT_COL_PX)) * 0.75;
const rowPt = (sh: SheetSnap, r: number) =>
  (sh.rowData?.[r]?.hd ? 0 : (sh.rowData?.[r]?.h ?? sh.defaultRowHeight ?? DEFAULT_ROW_PX)) * 0.75;

export function layoutSheet(sh: SheetSnap, setupIn?: Partial<PageSetup>): Layout {
  const su = mergeSetup(setupIn);
  const warnings: string[] = [];
  const ext = usedExtent(sh);
  const base = {
    pages: [] as Page[],
    scale: 1,
    paper: PAPER_PT[su.paper] ?? PAPER_PT.letter,
    content: { x: 0, y: 0, w: 0, h: 0 },
    colW: (c: number) => colPt(sh, c),
    rowH: (r: number) => rowPt(sh, r),
    warnings,
  };
  let area = su.printArea ? parseArea(su.printArea) : null;
  if (su.printArea && !area) warnings.push(`Print area "${su.printArea}" isn't valid; printing the whole sheet.`);
  if (!area) {
    if (ext.r < 0)
      return { ...base, area: { r0: 0, c0: 0, r1: -1, c1: -1 }, error: 'The sheet is empty — nothing to print.' };
    area = { r0: 0, c0: 0, r1: ext.r, c1: ext.c };
  }
  let [pw, ph] = base.paper;
  if (su.orientation === 'landscape') [pw, ph] = [ph, pw];
  const M = su.margins;
  const content = { x: M.l * 72, y: M.t * 72, w: pw - (M.l + M.r) * 72, h: ph - (M.t + M.b) * 72 };
  if (content.w < 36 || content.h < 36)
    return { ...base, area, paper: [pw, ph], content, error: 'The margins leave no room for content.' };
  const visRows: number[] = [];
  for (let r = area.r0; r <= area.r1; r++) if (rowPt(sh, r) > 0) visRows.push(r);
  const visCols: number[] = [];
  for (let c = area.c0; c <= area.c1; c++) if (colPt(sh, c) > 0) visCols.push(c);
  const totW = visCols.reduce((a, c) => a + colPt(sh, c), 0),
    totH = visRows.reduce((a, r) => a + rowPt(sh, r), 0);
  const hw = su.headings ? 1 : 0;
  let scale = Math.max(0.1, Math.min(4, su.scale / 100));
  if (su.useFit) {
    const fw = su.fitW > 0 ? content.w / (totW + hw * 24 || 1) : Infinity,
      fh = su.fitH > 0 ? content.h / (totH + hw * 14 || 1) : Infinity;
    scale = Math.min(1, fw, fh);
    if (!Number.isFinite(scale)) scale = 1;
    scale = Math.max(0.1, scale);
    if (su.fitW > 1 || su.fitH > 1) {
      scale = Math.min(
        1,
        Math.max(
          0.1,
          Math.min(
            su.fitW > 0 ? (su.fitW * content.w) / (totW + hw * 24 || 1) : Infinity,
            su.fitH > 0 ? (su.fitH * content.h) / (totH + hw * 14 || 1) : Infinity,
          ),
        ),
      );
    }
  }
  const titleR = parseTitleRows(su.titleRows),
    titleC = parseTitleCols(su.titleCols);
  const tRows = titleR ? visRows.filter((r) => r >= titleR[0] && r <= titleR[1]) : [];
  const tCols = titleC ? visCols.filter((c) => c >= titleC[0] && c <= titleC[1]) : [];
  const availW = content.w / scale - hw * 24,
    availH = content.h / scale - hw * 14;
  const bandsOf = (
    items: number[],
    size: (i: number) => number,
    avail: number,
    titles: number[],
    breaks: number[],
  ): number[][] => {
    const out: number[][] = [];
    let cur: number[] = [];
    let used = 0;
    let body = 0;
    for (const it of items) {
      if (titles.includes(it) && cur.includes(it)) continue;
      const s = size(it);
      if (body > 0 && (breaks.includes(it) || used + s > avail + 1e-6)) {
        out.push(cur);
        cur = titles.filter((t) => t < it);
        used = cur.reduce((a, i) => a + size(i), 0);
        body = 0;
      }
      cur.push(it);
      used += s;
      body++;
    }
    if (cur.length) out.push(cur);
    return out;
  };
  const rowBands = bandsOf(visRows, (r) => rowPt(sh, r), availH, tRows, su.rowBreaks);
  const colBands = bandsOf(visCols, (c) => colPt(sh, c), availW, tCols, su.colBreaks);
  const pages: Page[] = [];
  const push = (ri: number, ci: number) =>
    pages.push({ index: pages.length, rows: rowBands[ri], cols: colBands[ci], band: { r: ri, c: ci } });
  if (su.pageOrder === 'down')
    for (let ci = 0; ci < colBands.length; ci++) for (let ri = 0; ri < rowBands.length; ri++) push(ri, ci);
  else for (let ri = 0; ri < rowBands.length; ri++) for (let ci = 0; ci < colBands.length; ci++) push(ri, ci);
  if (pages.length > 500) warnings.push(`This prints ${pages.length} pages. Consider "Fit to" or a print area.`);
  return { pages, scale, paper: [pw, ph], content, area, colW: base.colW, rowH: base.rowH, warnings };
}

/* ---------- drawing ops ---------- */
export type Op =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; w: number; dash?: number[] }
  | {
      k: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      bold: boolean;
      italic: boolean;
      color: string;
      font?: string;
      underline?: boolean;
      strike?: boolean;
      clip?: { x: number; y: number; w: number; h: number };
    };
export interface PageOps {
  w: number;
  h: number;
  ops: Op[];
  pageNo: number;
}

const H_W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];
const HB_W = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
  556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584,
];
export const charW = (ch: string, bold: boolean): number => {
  const c = ch.charCodeAt(0);
  const t = bold ? HB_W : H_W;
  if (c >= 32 && c <= 126) return t[c - 32] / 1000;
  if (c === 9) return 0.556 * 4;
  if (c >= 0x4e00) return 1;
  return 0.556;
};
export const textW = (s: string, size: number, bold = false) => {
  let w = 0;
  for (const ch of s) w += charW(ch, bold);
  return w * size;
};
function wrapLines(text: string, size: number, bold: boolean, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      if (textW(line + word, size, bold) <= width || !line.trim()) {
        if (textW(word, size, bold) > width && !line.trim()) {
          let chunk = line;
          for (const ch of word) {
            if (textW(chunk + ch, size, bold) > width && chunk) {
              out.push(chunk);
              chunk = '';
            }
            chunk += ch;
          }
          line = chunk;
        } else line += word;
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line);
  }
  return out;
}
const hex = (c: string | undefined, d: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : d);
const gray = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  const g = Math.round(0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255));
  return '#' + g.toString(16).padStart(2, '0').repeat(3);
};

export interface RenderCtx {
  snap: Snap;
  sheet: SheetSnap;
  setup?: Partial<PageSetup>;
  fileName?: string;
  display?: (r: number, c: number) => string;
  now?: Date;
}
export function renderPages(ctx: RenderCtx): { layout: Layout; pages: PageOps[] } {
  const su = mergeSetup(ctx.setup);
  const lay = layoutSheet(ctx.sheet, su);
  if (lay.error) return { layout: lay, pages: [] };
  const sh = ctx.sheet;
  const total = lay.pages.length;
  const pages: PageOps[] = [];
  const merges = new Map<string, { r1: number; c1: number }>();
  const covered = new Set<string>();
  for (const m of sh.mergeData ?? []) {
    merges.set(`${m.startRow},${m.startColumn}`, { r1: m.endRow, c1: m.endColumn });
    for (let r = m.startRow; r <= m.endRow; r++)
      for (let c = m.startColumn; c <= m.endColumn; c++)
        if (r !== m.startRow || c !== m.startColumn) covered.add(`${r},${c}`);
  }
  const colorFix = (c: string) => (su.blackWhite ? gray(c) : c);
  const hh = su.headings ? 14 : 0,
    hw = su.headings ? 24 : 0;
  const s = lay.scale;
  for (const pg of lay.pages) {
    const ops: Op[] = [];
    const gw = pg.cols.reduce((a, c) => a + lay.colW(c), 0) * s + hw * s,
      gh = pg.rows.reduce((a, r) => a + lay.rowH(r), 0) * s + hh * s;
    const ox = lay.content.x + (su.centerH ? Math.max(0, (lay.content.w - gw) / 2) : 0),
      oy = lay.content.y + (su.centerV ? Math.max(0, (lay.content.h - gh) / 2) : 0);
    const xs = new Map<number, number>(),
      ys = new Map<number, number>();
    let x = ox + hw * s;
    for (const c of pg.cols) {
      xs.set(c, x);
      x += lay.colW(c) * s;
    }
    let y = oy + hh * s;
    for (const r of pg.rows) {
      ys.set(r, y);
      y += lay.rowH(r) * s;
    }
    const right = x,
      bottom = y;
    // fills first
    for (const r of pg.rows)
      for (const c of pg.cols) {
        if (covered.has(`${r},${c}`)) continue;
        const cell = sh.cellData?.[r]?.[c];
        const st = styleOf(ctx.snap, cell);
        const bg = st.bg?.rgb;
        if (!bg) continue;
        const mg = merges.get(`${r},${c}`);
        const x0 = xs.get(c)!,
          y0 = ys.get(r)!;
        const x1 = mg ? (xs.get(mg.c1) ?? right - 0) + (xs.has(mg.c1) ? lay.colW(mg.c1) * s : 0) : x0 + lay.colW(c) * s;
        const y1 = mg ? (ys.get(mg.r1) ?? bottom) + (ys.has(mg.r1) ? lay.rowH(mg.r1) * s : 0) : y0 + lay.rowH(r) * s;
        if (su.blackWhite && bg !== '#ffffff') {
          ops.push({ k: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, fill: colorFix(bg) });
        } else ops.push({ k: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, fill: bg });
      }
    if (su.gridlines) {
      const gc = '#bfbfbf';
      for (const r of pg.rows) {
        ops.push({ k: 'line', x1: ox + hw * s, y1: ys.get(r)!, x2: right, y2: ys.get(r)!, color: gc, w: 0.4 });
      }
      ops.push({ k: 'line', x1: ox + hw * s, y1: bottom, x2: right, y2: bottom, color: gc, w: 0.4 });
      for (const c of pg.cols)
        ops.push({ k: 'line', x1: xs.get(c)!, y1: oy + hh * s, x2: xs.get(c)!, y2: bottom, color: gc, w: 0.4 });
      ops.push({ k: 'line', x1: right, y1: oy + hh * s, x2: right, y2: bottom, color: gc, w: 0.4 });
    }
    if (su.headings) {
      const hs = 8 * s;
      for (const c of pg.cols) {
        const w = lay.colW(c) * s;
        ops.push({ k: 'rect', x: xs.get(c)!, y: oy, w, h: hh * s, fill: '#e8e8e8' });
        const nm = colName(c);
        ops.push({
          k: 'text',
          x: xs.get(c)! + (w - textW(nm, hs)) / 2,
          y: oy + hh * s - 3 * s,
          text: nm,
          size: hs,
          bold: false,
          italic: false,
          color: '#444444',
        });
        ops.push({ k: 'line', x1: xs.get(c)!, y1: oy, x2: xs.get(c)!, y2: oy + hh * s, color: '#999999', w: 0.4 });
      }
      for (const r of pg.rows) {
        const h = lay.rowH(r) * s;
        ops.push({ k: 'rect', x: ox, y: ys.get(r)!, w: hw * s, h, fill: '#e8e8e8' });
        const nm = String(r + 1);
        ops.push({
          k: 'text',
          x: ox + (hw * s - textW(nm, hs)) / 2,
          y: ys.get(r)! + h - 3 * s,
          text: nm,
          size: hs,
          bold: false,
          italic: false,
          color: '#444444',
        });
        ops.push({ k: 'line', x1: ox, y1: ys.get(r)!, x2: ox + hw * s, y2: ys.get(r)!, color: '#999999', w: 0.4 });
      }
    }
    // text + borders
    for (const r of pg.rows)
      for (let ci = 0; ci < pg.cols.length; ci++) {
        const c = pg.cols[ci];
        if (covered.has(`${r},${c}`)) continue;
        const cell = sh.cellData?.[r]?.[c];
        const st = styleOf(ctx.snap, cell);
        const mg = merges.get(`${r},${c}`);
        const x0 = xs.get(c)!,
          y0 = ys.get(r)!;
        const cw =
          (mg ? pg.cols.filter((k) => k >= c && k <= mg.c1).reduce((a, k) => a + lay.colW(k), 0) : lay.colW(c)) * s;
        const chh =
          (mg ? pg.rows.filter((k) => k >= r && k <= mg.r1).reduce((a, k) => a + lay.rowH(k), 0) : lay.rowH(r)) * s;
        drawBorders(ops, st, x0, y0, cw, chh, colorFix);
        const raw = cellValue(cell);
        const text = ctx.display ? ctx.display(r, c) : displayText(raw, st.n?.pattern);
        if (text === '') continue;
        const size = (st.fs ?? 11) * s * 0.9;
        const bold = !!st.bl;
        const isNum = (typeof raw === 'number' && !ctx.display) || typeof raw === 'number';
        const ht = st.ht ?? (isNum ? 3 : typeof raw === 'boolean' ? 2 : 1);
        const pad = 2 * s;
        const color = colorFix(hex(st.cl?.rgb, '#000000'));
        const wrap = st.tb === 3;
        const clip = { x: x0, y: y0, w: cw, h: chh };
        let lines: string[];
        let avail = cw - pad * 2;
        if (wrap) lines = wrapLines(text, size, bold, avail);
        else {
          lines = text.split('\n').slice(0, 1);
          if (ht === 1 && !isNum && !mg) {
            let extra = 0;
            for (let k = ci + 1; k < pg.cols.length; k++) {
              const cc = pg.cols[k];
              const nx = sh.cellData?.[r]?.[cc];
              if (cellValue(nx) !== null || nx?.f || covered.has(`${r},${cc}`)) break;
              extra += lay.colW(cc) * s;
            }
            avail += extra;
            clip.w += extra;
          }
        }
        const lh = size * 1.2;
        const blockH = lines.length * lh;
        const vt = st.vt ?? 3;
        let ty =
          vt === 1
            ? y0 + lh * 0.85 + pad / 2
            : vt === 2
              ? y0 + (chh - blockH) / 2 + lh * 0.85
              : y0 + chh - blockH + lh * 0.85 - pad / 2;
        for (const ln of lines) {
          const w = textW(ln, size, bold);
          const tx = ht === 3 ? x0 + cw - pad - w : ht === 2 ? x0 + (cw - w) / 2 : x0 + pad;
          ops.push({
            k: 'text',
            x: tx,
            y: ty,
            text: ln,
            size,
            bold,
            italic: !!st.it,
            color,
            font: st.ff,
            underline: !!st.ul?.s,
            strike: !!st.st?.s,
            clip: { ...clip },
          });
          ty += lh;
        }
      }
    // header / footer
    const ctxHF: HFCtx = {
      page: pg.index + 1,
      pages: total,
      sheet: sh.name,
      file: ctx.fileName ?? 'Workbook',
      now: ctx.now ?? new Date(),
    };
    const hf = (h: HF, yy: number) => {
      const put = (t: string, al: 'l' | 'c' | 'r') => {
        const txt = expandHF(t, ctxHF);
        if (!txt) return;
        const sz = 9;
        const w = textW(txt, sz);
        const xx =
          al === 'l'
            ? lay.content.x
            : al === 'c'
              ? lay.content.x + (lay.content.w - w) / 2
              : lay.content.x + lay.content.w - w;
        ops.push({ k: 'text', x: xx, y: yy, text: txt, size: sz, bold: false, italic: false, color: '#000000' });
      };
      put(h.l, 'l');
      put(h.c, 'c');
      put(h.r, 'r');
    };
    hf(su.header, su.margins.header * 72 + 9);
    hf(su.footer, lay.paper[1] - su.margins.footer * 72);
    pages.push({ w: lay.paper[0], h: lay.paper[1], ops, pageNo: pg.index + 1 });
  }
  return { layout: lay, pages };
}
function drawBorders(ops: Op[], st: Style, x: number, y: number, w: number, h: number, fix: (c: string) => string) {
  const bd = st.bd;
  if (!bd) return;
  const one = (
    d: { s?: number; cl?: { rgb?: string } } | undefined,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    if (!d || !d.s) return;
    const wd = d.s === 8 || d.s === 9 ? 1.5 : d.s === 13 ? 2.2 : d.s === 7 ? 1.4 : d.s === 2 ? 0.3 : 0.7;
    ops.push({
      k: 'line',
      x1,
      y1,
      x2,
      y2,
      color: fix(hex(d.cl?.rgb, '#000000')),
      w: wd,
      dash: d.s === 3 ? [1, 1] : d.s === 4 || d.s === 9 ? [3, 2] : d.s === 5 || d.s === 10 ? [4, 2, 1, 2] : undefined,
    });
  };
  one(bd.t, x, y, x + w, y);
  one(bd.b, x, y + h, x + w, y + h);
  one(bd.l, x, y, x, y + h);
  one(bd.r, x + w, y, x + w, y + h);
}

/* ---------- SVG backend ---------- */
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
export function pageToSvg(p: PageOps, opts: { border?: boolean } = {}): string {
  let clipN = 0;
  const defs: string[] = [];
  const body: string[] = [];
  for (const o of p.ops) {
    if (o.k === 'rect')
      body.push(
        `<rect x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" width="${o.w.toFixed(2)}" height="${o.h.toFixed(2)}" fill="${o.fill}"/>`,
      );
    else if (o.k === 'line')
      body.push(
        `<line x1="${o.x1.toFixed(2)}" y1="${o.y1.toFixed(2)}" x2="${o.x2.toFixed(2)}" y2="${o.y2.toFixed(2)}" stroke="${o.color}" stroke-width="${o.w}"${o.dash ? ` stroke-dasharray="${o.dash.join(' ')}"` : ''}/>`,
      );
    else {
      let c = '';
      if (o.clip) {
        const id = `c${clipN++}`;
        defs.push(
          `<clipPath id="${id}"><rect x="${o.clip.x.toFixed(2)}" y="${o.clip.y.toFixed(2)}" width="${o.clip.w.toFixed(2)}" height="${o.clip.h.toFixed(2)}"/></clipPath>`,
        );
        c = ` clip-path="url(#${id})"`;
      }
      const deco = [o.underline ? 'underline' : '', o.strike ? 'line-through' : ''].filter(Boolean).join(' ');
      body.push(
        `<text x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" font-family="${esc(o.font ? o.font + ', ' : '')}Helvetica, Arial, sans-serif" font-size="${o.size.toFixed(2)}"${o.bold ? ' font-weight="bold"' : ''}${o.italic ? ' font-style="italic"' : ''}${deco ? ` text-decoration="${deco}"` : ''} fill="${o.color}"${c} xml:space="preserve">${esc(o.text)}</text>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}pt" height="${p.h}pt"><rect width="${p.w}" height="${p.h}" fill="#fff"${opts.border ? ' stroke="#ccc"' : ''}/>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body.join('')}</svg>`;
}
export function printHtml(pages: PageOps[], title: string): string {
  const [w, h] = pages.length ? [pages[0].w, pages[0].h] : [612, 792];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:${w}pt ${h}pt;margin:0}html,body{margin:0;padding:0}.pg{width:${w}pt;height:${h}pt;page-break-after:always;overflow:hidden}.pg:last-child{page-break-after:auto}.pg svg{display:block}</style></head><body>${pages.map((p) => `<div class="pg">${pageToSvg(p)}</div>`).join('')}</body></html>`;
}
export type { Cell };

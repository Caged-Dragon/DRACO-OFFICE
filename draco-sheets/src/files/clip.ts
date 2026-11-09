// Paste from Excel / Google Sheets / web tables (v84): HTML clipboard -> cells with formatting.
import { findAll, fromArgb, parseXml, textOf, type Style, type XNode } from './model';
import { parseDelimited } from '../query/query';
import { maxOf } from '../formulas/safeMath';

export interface ClipCell {
  v?: string | number | boolean;
  f?: string;
  style: Style;
  text: string;
}
export interface ClipGrid {
  cells: Array<Array<ClipCell | null>>;
  merges: Array<{ r: number; c: number; rows: number; cols: number }>;
  rows: number;
  cols: number;
  source: 'excel' | 'sheets' | 'html' | 'text';
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  maroon: '#800000',
  lime: '#00ff00',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
  olive: '#808000',
};
export function cssColor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/\s*!important/, '');
  if (!s || s === 'transparent' || s === 'windowtext' || s === 'inherit' || s === 'none' || s === 'auto')
    return undefined;
  if (NAMED[s]) return NAMED[s];
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m)
    return (
      '#' +
      m[1]
        .split('')
        .map((x) => x + x)
        .join('')
    );
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return s;
  const r = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(s);
  if (r) {
    if (r[4] !== undefined && +r[4] === 0) return undefined;
    return '#' + [r[1], r[2], r[3]].map((x) => Math.min(255, +x).toString(16).padStart(2, '0')).join('');
  }
  return undefined;
}
function decls(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of css.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}
function sheetRules(styleText: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  const clean = styleText.replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^}]*)\}/g))
    for (const sel of m[1].split(',')) {
      const k = sel.trim().toLowerCase();
      if (!k || k.startsWith('@')) continue;
      rules.set(k, { ...(rules.get(k) ?? {}), ...decls(m[2]) });
    }
  return rules;
}
const borderW = (v: string) => {
  const m = /([\d.]+)(px|pt)?/.exec(v);
  return m ? parseFloat(m[1]) * (m[2] === 'pt' ? 1.33 : 1) : 1;
};
function toStyle(d: Record<string, string>, attrs: Record<string, string>): { style: Style; numfmt?: string } {
  const st: Style = {};
  const fw = d['font-weight'];
  if (fw === 'bold' || fw === 'bolder' || +fw >= 600) st.bl = 1;
  if (d['font-style'] === 'italic') st.it = 1;
  const td = `${d['text-decoration'] ?? ''} ${d['text-decoration-line'] ?? ''}`;
  if (/underline/.test(td)) st.ul = { s: 1 };
  if (/line-through/.test(td)) st.st = { s: 1 };
  const col = cssColor(d.color);
  if (col && col !== '#000000') st.cl = { rgb: col };
  const bg = cssColor(
    d['background-color'] ??
      (d.background && !/url\(/.test(d.background) ? d.background.split(/\s+/).find((x) => cssColor(x)) : undefined) ??
      attrs.bgcolor,
  );
  if (bg && bg !== '#ffffff') st.bg = { rgb: bg };
  const fs = d['font-size'];
  if (fs) {
    const m = /([\d.]+)(pt|px)?/.exec(fs);
    if (m) {
      const pt = m[2] === 'px' ? parseFloat(m[1]) * 0.75 : parseFloat(m[1]);
      if (pt && Math.round(pt) !== 11 && Math.round(pt) !== 10) st.fs = Math.round(pt * 2) / 2;
    }
  }
  const ff = d['font-family'];
  if (ff) {
    const f = ff.split(',')[0].replace(/["']/g, '').trim();
    if (f && !/^(calibri|inherit|sans-serif|arial,)$/i.test(f) && f.toLowerCase() !== 'calibri') st.ff = f;
  }
  const ta = d['text-align'] ?? attrs.align;
  if (ta === 'left') st.ht = 1;
  else if (ta === 'center') st.ht = 2;
  else if (ta === 'right') st.ht = 3;
  const va = d['vertical-align'] ?? attrs.valign;
  if (va === 'top') st.vt = 1;
  else if (va === 'middle' || va === 'center') st.vt = 2;
  else if (va === 'bottom') st.vt = 3;
  if (/normal|pre-wrap|break-spaces/.test(d['white-space'] ?? '') && d['white-space'] !== 'nowrap') st.tb = 3;
  const bd: NonNullable<Style['bd']> = {};
  for (const [k, key] of [
    ['top', 't'],
    ['bottom', 'b'],
    ['left', 'l'],
    ['right', 'r'],
  ] as const) {
    const v = d[`border-${k}`] ?? d.border;
    if (!v || /none|hidden/.test(v)) continue;
    const c = cssColor(v.split(/\s+(?![^(]*\))/).find((x) => cssColor(x))) ?? '#000000';
    const w = borderW(v);
    bd[key] = {
      s: /double/.test(v) ? 7 : /dashed/.test(v) ? 4 : /dotted/.test(v) ? 3 : w >= 2 ? 8 : 1,
      cl: { rgb: c },
    };
  }
  if (Object.keys(bd).length) st.bd = bd;
  let numfmt: string | undefined;
  const nf = d['mso-number-format'];
  if (nf && nf !== 'General' && nf !== '"General"')
    numfmt = nf
      .replace(/^"|"$/g, '')
      .replace(/\\(.)/g, '$1')
      .replace(/&quot;/g, '"');
  if (numfmt) st.n = { pattern: numfmt };
  return { style: st, numfmt };
}
const num = (s: string): number | undefined => {
  const t = s.trim().replace(/ /g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t.replace(/,(?=\d{3}(\D|$))/g, ''))) return undefined;
  return parseFloat(t.replace(/,/g, ''));
};
function cellOf(td: XNode, rules: Map<string, Record<string, string>>, source: ClipGrid['source']): ClipCell {
  const classes = (td.attrs.class ?? '').split(/\s+/).filter(Boolean);
  const d: Record<string, string> = { ...(rules.get('td') ?? {}), ...(rules.get('td') ? {} : {}) };
  for (const c of classes)
    Object.assign(d, rules.get('.' + c.toLowerCase()) ?? {}, rules.get('td.' + c.toLowerCase()) ?? {});
  Object.assign(d, decls(td.attrs.style ?? ''));
  const { style } = toStyle(d, td.attrs);
  let text = textOf(td, true)
    .replace(/ /g, ' ')
    .replace(/[\r\n]+\s*/g, (m) =>
      m.includes('\n') && td.parts.some((p) => typeof p !== 'string' && p.tag === 'br') ? '\n' : ' ',
    )
    .replace(/ {2,}/g, ' ')
    .trim();
  const out: ClipCell = { style, text };
  // exact values supplied by the source apps
  const xnum = td.attrs['x:num'];
  const gs = td.attrs['data-sheets-value'];
  const fm = td.attrs['x:fmla'];
  if (fm) out.f = fm.startsWith('=') ? fm : '=' + fm;
  if (xnum !== undefined && xnum !== '' && !isNaN(+xnum)) {
    out.v = +xnum;
    return out;
  }
  if (td.attrs['x:bool'] !== undefined) {
    out.v = td.attrs['x:bool'].toUpperCase() === 'TRUE';
    return out;
  }
  if (gs) {
    try {
      const j = JSON.parse(gs) as Record<string, unknown>;
      if (j['1'] === 3 && typeof j['3'] === 'number') {
        out.v = j['3'];
        return out;
      }
      if (j['1'] === 4 && typeof j['4'] === 'boolean') {
        out.v = j['4'];
        return out;
      }
      if (j['1'] === 2 && typeof j['2'] === 'string') {
        out.v = j['2'];
        return out;
      }
    } catch {
      /* fall through to text */
    }
  }
  if (text === '') return out;
  if (/^(true|false)$/i.test(text) && source !== 'html') {
    out.v = text.toUpperCase() === 'TRUE';
    return out;
  }
  const n = num(text);
  if (n !== undefined && !/^0\d/.test(text.replace(/^[-+]/, ''))) {
    out.v = n;
    return out;
  }
  const pct = /^([-+]?\d+(?:\.\d+)?)%$/.exec(text);
  if (pct) {
    out.v = parseFloat(pct[1]) / 100;
    out.style = { ...out.style, n: out.style.n ?? { pattern: '0%' } };
    return out;
  }
  const cur = /^([-+(]?)[$€£¥]\s?([\d,]+(?:\.\d+)?)\)?$/.exec(text);
  if (cur) {
    out.v = parseFloat(cur[2].replace(/,/g, '')) * (cur[1] === '-' || cur[1] === '(' ? -1 : 1);
    out.style = { ...out.style, n: out.style.n ?? { pattern: '$#,##0.00' } };
    return out;
  }
  out.v = text;
  return out;
}
export function htmlToGrid(html: string): ClipGrid | null {
  const root = parseXml(html, true);
  const tables = findAll(root, 'table');
  if (!tables.length) return null;
  const table = tables.find((t) => !findAll(t, 'table').length) ?? tables[0];
  const styleText = findAll(root, 'style')
    .map((s) => s.text)
    .join('\n');
  const rules = sheetRules(styleText);
  const source: ClipGrid['source'] = /urn:schemas-microsoft-com:office:excel|ProgId.*Excel|xl\d+/i.test(
    html.slice(0, 4000),
  )
    ? 'excel'
    : /google-sheets|data-sheets/i.test(html.slice(0, 4000))
      ? 'sheets'
      : 'html';
  const trs = findAll(table, 'tr');
  const used = new Set<string>();
  const cells: Array<Array<ClipCell | null>> = [];
  const merges: ClipGrid['merges'] = [];
  let cols = 0;
  trs.forEach((tr, r) => {
    let c = 0;
    cells[r] ??= [];
    for (const td of tr.kids.filter((k) => k.tag === 'td' || k.tag === 'th')) {
      while (used.has(`${r},${c}`)) c++;
      const cs = Math.max(1, +(td.attrs.colspan ?? 1) || 1),
        rs = Math.max(1, +(td.attrs.rowspan ?? 1) || 1);
      const cell = cellOf(td, rules, source);
      if (td.tag === 'th' && !cell.style.bl) cell.style = { ...cell.style, bl: 1 };
      cells[r][c] = cell;
      if (cs > 1 || rs > 1) {
        merges.push({ r, c, rows: rs, cols: cs });
        for (let i = 0; i < rs; i++)
          for (let j = 0; j < cs; j++)
            if (i || j) {
              used.add(`${r + i},${c + j}`);
            }
      }
      c += cs;
      cols = Math.max(cols, c);
    }
  });
  const rows = cells.length;
  if (!rows || !cols) return null;
  for (const row of cells) for (let c = 0; c < cols; c++) row[c] ??= null;
  return { cells, merges, rows, cols, source };
}
/** Plain text clipboard (tab separated rows, as Excel/Sheets put on the clipboard). */
export function textToGrid(text: string): ClipGrid | null {
  if (!text) return null;
  const g = parseDelimited(
    text.replace(/\r\n?/g, '\n').replace(/\n$/, ''),
    text.includes('\t') ? '\t' : text.includes('\n') ? '\u0000' : '\u0000',
  );
  const cols = maxOf(
    g.map((r) => r.length),
    [0],
  );
  const cells = g.map((r) =>
    Array.from({ length: cols }, (_, c) => {
      const v = r[c];
      if (v === null || v === undefined || v === '') return null;
      const t = typeof v === 'string' ? v : String(v);
      return { v, style: {}, text: t } as ClipCell;
    }),
  );
  return cells.length ? { cells, merges: [], rows: cells.length, cols, source: 'text' } : null;
}
export function clipToGrid(html: string | undefined, text: string | undefined): ClipGrid | null {
  return (html ? htmlToGrid(html) : null) ?? (text ? textToGrid(text) : null);
}
export { fromArgb };

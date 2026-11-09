// Shared helpers for file converters: snapshot typing, A1 helpers, colours, tiny XML parser.
export interface Style {
  bl?: number;
  it?: number;
  ul?: { s?: number; cl?: { rgb?: string } };
  st?: { s?: number };
  bg?: { rgb?: string };
  cl?: { rgb?: string };
  fs?: number;
  ff?: string;
  ht?: number;
  vt?: number;
  tb?: number;
  n?: { pattern?: string };
  bd?: { t?: Bd; b?: Bd; l?: Bd; r?: Bd };
}
export interface Bd {
  s?: number;
  cl?: { rgb?: string };
}
export interface Cell {
  v?: string | number | boolean | null;
  t?: number;
  f?: string;
  si?: string;
  s?: string | Style | null;
}
export interface SheetSnap {
  id: string;
  name: string;
  rowCount?: number;
  columnCount?: number;
  hidden?: number;
  tabColor?: string;
  cellData?: Record<string, Record<string, Cell>>;
  mergeData?: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }>;
  rowData?: Record<string, { h?: number; hd?: number }>;
  columnData?: Record<string, { w?: number; hd?: number }>;
  freeze?: { xSplit: number; ySplit: number; startRow: number; startColumn: number };
  showGridlines?: number;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  [k: string]: unknown;
}
export interface Snap {
  id?: string;
  name?: string;
  locale?: string;
  sheetOrder: string[];
  sheets: Record<string, SheetSnap>;
  styles?: Record<string, Style>;
  resources?: Array<{ name: string; data: string }>;
  [k: string]: unknown;
}

export const DEFAULT_COL_PX = 88,
  DEFAULT_ROW_PX = 24;
export const colName = (c: number): string => {
  let s = '';
  c++;
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
};
export const colIndex = (s: string): number => {
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};
export const a1 = (r: number, c: number) => `${colName(c)}${r + 1}`;
export function parseA1(s: string): { r: number; c: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s.trim());
  return m ? { r: +m[2] - 1, c: colIndex(m[1]) } : null;
}

export const styleOf = (snap: Snap, cell: Cell | undefined): Style => {
  const s = cell?.s;
  if (!s) return {};
  return typeof s === 'string' ? (snap.styles?.[s] ?? {}) : s;
};
export const orderedSheets = (snap: Snap): SheetSnap[] =>
  (snap.sheetOrder?.length ? snap.sheetOrder : Object.keys(snap.sheets)).map((id) => snap.sheets[id]).filter(Boolean);
/** Last used row/column (0-based, inclusive) of a sheet; -1 when empty. */
export function usedExtent(sh: SheetSnap): { r: number; c: number } {
  let r = -1,
    c = -1;
  for (const [rk, row] of Object.entries(sh.cellData ?? {}))
    for (const [ck, cell] of Object.entries(row)) {
      const has = cell && ((cell.v !== undefined && cell.v !== null && cell.v !== '') || cell.f);
      if (has) {
        r = Math.max(r, +rk);
        c = Math.max(c, +ck);
      }
    }
  for (const m of sh.mergeData ?? []) {
    r = Math.max(r, m.endRow);
    c = Math.max(c, m.endColumn);
  }
  return { r, c };
}
export const cellValue = (cell: Cell | undefined): string | number | boolean | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (cell.t === 3) return cell.v === 1 || cell.v === true || cell.v === 'TRUE' || cell.v === 'true';
  return cell.v;
};

/** '#RRGGBB' (or 'RRGGBB' / 'AARRGGBB') -> 'AARRGGBB' upper-case argb */
export function toArgb(c: string | undefined): string | undefined {
  if (!c) return undefined;
  let h = c.trim().replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((x) => x + x)
      .join('');
  if (h.length === 6) return ('FF' + h).toUpperCase();
  if (h.length === 8) return h.toUpperCase();
  return undefined;
}
export function fromArgb(a: string | undefined): string | undefined {
  if (!a) return undefined;
  const h = a.length === 8 ? a.slice(2) : a;
  return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toLowerCase() : undefined;
}
export const OFFICE_THEME = [
  '#ffffff',
  '#000000',
  '#e7e6e6',
  '#44546a',
  '#4472c4',
  '#ed7d31',
  '#a5a5a5',
  '#ffc000',
  '#5b9bd5',
  '#70ad47',
];
export function applyTint(hex: string, tint: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(tint < 0 ? v * (1 + tint) : v + (255 - v) * tint),
  );
  return '#' + ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** Excel serial date <-> JS Date (1900 system, UTC, with the 1900 leap-year quirk). */
export const dateToSerial = (d: Date): number => d.getTime() / 86400000 + 25569;
export const serialToDate = (s: number): Date => new Date(Math.round((s - 25569) * 86400000));

/* ---------- minimal XML parser (enough for OOXML / ODF / HTML tables) ---------- */
export interface XNode {
  tag: string;
  attrs: Record<string, string>;
  kids: XNode[];
  text: string;
  parts: Array<string | XNode>;
  parent?: XNode;
}
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(cp);
      } catch {
        return m;
      }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
export const escapeXml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'col', 'input']);
export function parseXml(src: string, html = false): XNode {
  const root: XNode = { tag: '#root', attrs: {}, kids: [], text: '', parts: [] };
  let cur = root;
  let i = 0;
  const n = src.length;
  const pushText = (t: string) => {
    if (t) {
      const u = unescapeXml(t);
      cur.text += u;
      cur.parts.push(u);
    }
  };
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      pushText(src.slice(i));
      break;
    }
    pushText(src.slice(i, lt));
    i = lt;
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i);
      {
        const t = src.slice(i + 9, e < 0 ? n : e);
        cur.text += t;
        cur.parts.push(t);
      }
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith('<?', i) || src.startsWith('<!', i)) {
      const e = src.indexOf('>', i);
      i = e < 0 ? n : e + 1;
      continue;
    }
    if (src[i + 1] === '/') {
      const e = src.indexOf('>', i);
      const name = src
        .slice(i + 2, e < 0 ? n : e)
        .trim()
        .toLowerCase();
      i = e < 0 ? n : e + 1;
      let p: XNode | undefined = cur;
      while (p && p.tag !== name && p !== root) p = p.parent;
      if (p && p !== root) cur = p.parent ?? root;
      continue;
    }
    // open tag; find end respecting quotes
    let j = i + 1,
      q = '';
    while (j < n) {
      const ch = src[j];
      if (q) {
        if (ch === q) q = '';
      } else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '>') break;
      j++;
    }
    let body = src.slice(i + 1, j);
    const selfClose = body.endsWith('/');
    if (selfClose) body = body.slice(0, -1);
    const m = /^([^\s/>]+)/.exec(body);
    const tag = (m ? m[1] : '').toLowerCase();
    const attrs: Record<string, string> = {};
    const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let am: RegExpExecArray | null;
    const rest = body.slice(m ? m[0].length : 0);
    while ((am = re.exec(rest))) attrs[am[1].toLowerCase()] = unescapeXml(am[2] ?? am[3] ?? am[4] ?? '');
    const node: XNode = { tag, attrs, kids: [], text: '', parts: [], parent: cur };
    cur.kids.push(node);
    cur.parts.push(node);
    i = j + 1;
    if (!selfClose && !(html && VOID.has(tag))) cur = node;
    if (html && (tag === 'script' || tag === 'style')) {
      const e = src.toLowerCase().indexOf('</' + tag, i);
      node.text = src.slice(i, e < 0 ? n : e);
      i = e < 0 ? n : src.indexOf('>', e) + 1;
      cur = node.parent ?? root;
    }
  }
  return root;
}
export const findAll = (n: XNode, tag: string, out: XNode[] = []): XNode[] => {
  for (const k of n.kids) {
    if (k.tag === tag) out.push(k);
    findAll(k, tag, out);
  }
  return out;
};
export const child = (n: XNode, tag: string) => n.kids.find((k) => k.tag === tag);

/** Text of a node including descendants, in document order (<br> and block ends become newlines when `html`). */
export const textOf = (n: XNode, html = false): string =>
  n.parts
    .map((p) =>
      typeof p === 'string'
        ? p
        : p.tag === 'br' && html
          ? '\n'
          : p.tag === 'style' || p.tag === 'script'
            ? ''
            : textOf(p, html),
    )
    .join('');

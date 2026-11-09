// CSV / TSV / JSON / ODS converters between Univer snapshots and plain grids (v80).
import JSZip from 'jszip';
import { parseDelimited, tableFromJson } from '../query/query';
import {
  DEFAULT_COL_PX,
  DEFAULT_ROW_PX,
  child,
  cellValue,
  colName,
  dateToSerial,
  escapeXml,
  findAll,
  orderedSheets,
  parseXml,
  styleOf,
  textOf,
  usedExtent,
  type Cell,
  type SheetSnap,
  type Snap,
  type Style,
  type XNode,
} from './model';

export type Val = string | number | boolean | null;
let uidn = 0;
const nextId = () => `sheet-${Date.now().toString(36)}${(uidn++).toString(36)}`;

/** Raw values of a sheet up to its used extent (or the given rows/cols). */
export function sheetToGrid(sh: SheetSnap): Val[][] {
  const ext = usedExtent(sh);
  const out: Val[][] = [];
  for (let r = 0; r <= ext.r; r++) {
    const row: Val[] = [];
    for (let c = 0; c <= ext.c; c++) row.push(cellValue(sh.cellData?.[r]?.[c]));
    out.push(row);
  }
  return out;
}
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
export function inferCell(v: Val | undefined, dates = true): Cell | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return { v, t: 2 };
  if (typeof v === 'boolean') return { v: v ? 1 : 0, t: 3 };
  const s = String(v);
  const m = isoDate.exec(s);
  if (dates && m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCMonth() === +m[2] - 1) return { v: dateToSerial(d), t: 2, s: DATE_STYLE };
  }
  return { v: s, t: 1 };
}
const DATE_STYLE = '__date';
const DATE_PATTERN: Style = { n: { pattern: 'yyyy-mm-dd' } };
export function gridToSnapshot(grid: Val[][], sheetName = 'Sheet1', name = 'Imported workbook', infer = true): Snap {
  const cellData: Record<string, Record<string, Cell>> = {};
  let maxC = 0;
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      const cell = inferCell(v, infer);
      if (!cell) return;
      if (!infer && typeof v === 'string') {
        cell.v = v;
        cell.t = 1;
      }
      (cellData[r] ??= {})[c] = cell;
      maxC = Math.max(maxC, c + 1);
    }),
  );
  const id = nextId();
  const snap: Snap = {
    id: '',
    name,
    locale: 'enUS',
    sheetOrder: [id],
    sheets: {
      [id]: {
        id,
        name: sheetName,
        rowCount: Math.max(1000, grid.length + 100),
        columnCount: Math.max(26, maxC + 10),
        cellData,
        defaultColumnWidth: DEFAULT_COL_PX,
        defaultRowHeight: DEFAULT_ROW_PX,
      },
    },
    styles: { [DATE_STYLE]: DATE_PATTERN },
    resources: [],
  };
  return snap;
}

/* ---------- CSV / TSV ---------- */
export function gridToDelimited(
  grid: Array<Array<Val | undefined>>,
  delim = ',',
  opts: { bom?: boolean; eol?: string; quoteAll?: boolean } = {},
): string {
  const q = (v: Val | undefined) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
    return opts.quoteAll || s.includes(delim) || /["\r\n]/.test(s) || /^\s|\s$/.test(s)
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const body = grid.map((r) => r.map(q).join(delim)).join(opts.eol ?? '\r\n');
  return (opts.bom ? '﻿' : '') + body + (grid.length ? (opts.eol ?? '\r\n') : '');
}
export function delimitedToSnapshot(
  text: string,
  delim?: string,
  sheetName = 'Sheet1',
  name = 'Imported workbook',
): Snap {
  const grid = parseDelimited(text, delim) as Val[][];
  return gridToSnapshot(grid, sheetName, name, true);
}
/* ---------- JSON ---------- */
export function gridToJson(grid: Val[][], opts: { header: boolean; pretty?: boolean } = { header: true }): string {
  if (!opts.header || grid.length === 0) return JSON.stringify(grid, null, opts.pretty ? 2 : undefined);
  const heads = grid[0].map((h, i) => (h === null || h === '' ? `Column${i + 1}` : String(h)));
  const seen = new Map<string, number>();
  const keys = heads.map((h) => {
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n > 1 ? `${h}_${n}` : h;
  });
  const recs = grid
    .slice(1)
    .filter((r) => r.some((v) => v !== null))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? null])));
  return JSON.stringify(recs, null, opts.pretty ? 2 : undefined);
}
export function snapshotToJson(
  snap: Snap,
  opts: { header: boolean; pretty?: boolean; allSheets?: boolean; sheet?: number } = { header: true },
): string {
  const sheets = orderedSheets(snap);
  if (opts.allSheets)
    return JSON.stringify(
      Object.fromEntries(sheets.map((s) => [s.name, JSON.parse(gridToJson(sheetToGrid(s), { header: opts.header }))])),
      null,
      opts.pretty ? 2 : undefined,
    );
  return gridToJson(sheetToGrid(sheets[opts.sheet ?? 0] ?? sheets[0]), opts);
}
export function jsonToSnapshot(text: string, name = 'Imported workbook'): Snap {
  const t = tableFromJson(text);
  return gridToSnapshot([t.cols as Val[], ...(t.rows as Val[][])], 'Sheet1', name, false);
}

/* ---------- ODS ---------- */
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"';
/** Excel formula -> OpenFormula (of:=...). */
export function formulaToOds(f: string): string {
  const body = f.startsWith('=') ? f.slice(1) : f;
  let out = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] === '"') {
      let j = i + 1;
      while (j < body.length) {
        if (body[j] === '"') {
          if (body[j + 1] === '"') j += 2;
          else break;
        } else j++;
      }
      out += body.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const rest = body.slice(i);
    const prev = i > 0 ? body[i - 1] : '';
    const m = !/[A-Za-z0-9_.]/.test(prev)
      ? /^((?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![A-Za-z0-9_(])/.exec(
          rest,
        )
      : null;
    if (m) {
      const sheet = m[1] ? '$' + m[1].slice(0, -1) : '';
      out += `[${sheet}.${m[2]}${m[3] ? ':.' + m[3] : ''}]`;
      i += m[0].length;
      continue;
    }
    out += body[i] === ',' ? ';' : body[i];
    i++;
  }
  return 'of:=' + out;
}
export function formulaFromOds(f: string): string {
  let body = f.replace(/^of:/i, '').replace(/^oooc:/i, '');
  if (body.startsWith('=')) body = body.slice(1);
  let out = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] === '"') {
      let j = i + 1;
      while (j < body.length) {
        if (body[j] === '"') {
          if (body[j + 1] === '"') j += 2;
          else break;
        } else j++;
      }
      out += body.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (body[i] === '[') {
      const e = body.indexOf(']', i);
      const inner = body.slice(i + 1, e);
      const conv = (part: string) => {
        const m = /^\$?(?:('[^']+'|[^.']*))\.(.+)$/.exec(part);
        if (!m) return part.replace(/^\./, '');
        const sh = m[1];
        return sh
          ? `${/[^A-Za-z0-9_]/.test(sh.replace(/^'|'$/g, '')) && !sh.startsWith("'") ? `'${sh}'` : sh}!${m[2]}`
          : m[2];
      };
      const [a, b] = inner.split(/:(?=\$?[^:]*\.)/);
      const first = conv(a);
      out += b ? `${first}:${conv(b).replace(/^.*!/, '')}` : first;
      i = e + 1;
      continue;
    }
    out += body[i] === ';' ? ',' : body[i];
    i++;
  }
  return '=' + out;
}
const pxToIn = (px: number) => (px / 96).toFixed(4) + 'in';
export async function snapshotToOds(snap: Snap): Promise<Uint8Array> {
  const styleMap = new Map<string, string>();
  const styleXml: string[] = [];
  const sty = (st: Style): string => {
    if (!Object.keys(st).length) return '';
    const k = JSON.stringify(st);
    let n = styleMap.get(k);
    if (n) return n;
    n = 'ce' + (styleMap.size + 1);
    styleMap.set(k, n);
    const tp: string[] = [];
    if (st.bl) tp.push('fo:font-weight="bold"');
    if (st.it) tp.push('fo:font-style="italic"');
    if (st.ul?.s) tp.push('style:text-underline-style="solid"');
    if (st.st?.s) tp.push('style:text-line-through-style="solid"');
    if (st.cl?.rgb) tp.push(`fo:color="${st.cl.rgb}"`);
    if (st.fs) tp.push(`fo:font-size="${st.fs}pt"`);
    if (st.ff) tp.push(`style:font-name="${escapeXml(st.ff)}"`);
    const cp: string[] = [];
    if (st.bg?.rgb) cp.push(`fo:background-color="${st.bg.rgb}"`);
    if (st.tb === 3) cp.push('fo:wrap-option="wrap"');
    if (st.vt)
      cp.push(`style:vertical-align="${({ 1: 'top', 2: 'middle', 3: 'bottom' } as Record<number, string>)[st.vt]}"`);
    const pp = st.ht
      ? `<style:paragraph-properties fo:text-align="${({ 1: 'start', 2: 'center', 3: 'end' } as Record<number, string>)[st.ht]}"/>`
      : '';
    styleXml.push(
      `<style:style style:name="${n}" style:family="table-cell">${cp.length ? `<style:table-cell-properties ${cp.join(' ')}/>` : ''}${pp}${tp.length ? `<style:text-properties ${tp.join(' ')}/>` : ''}</style:style>`,
    );
    return n;
  };
  const tables: string[] = [];
  const colStyles: string[] = [];
  let cs = 0;
  for (const sh of orderedSheets(snap)) {
    const ext = usedExtent(sh);
    const rows = Math.max(ext.r, -1) + 1,
      cols = Math.max(ext.c, -1) + 1;
    const out: string[] = [];
    const covered = new Set<string>();
    const spans = new Map<string, { rs: number; cs: number }>();
    for (const m of sh.mergeData ?? []) {
      spans.set(`${m.startRow},${m.startColumn}`, {
        rs: m.endRow - m.startRow + 1,
        cs: m.endColumn - m.startColumn + 1,
      });
      for (let r = m.startRow; r <= m.endRow; r++)
        for (let c = m.startColumn; c <= m.endColumn; c++)
          if (r !== m.startRow || c !== m.startColumn) covered.add(`${r},${c}`);
    }
    const colXml: string[] = [];
    for (let c = 0; c < cols; c++) {
      const w = sh.columnData?.[c]?.w ?? sh.defaultColumnWidth ?? DEFAULT_COL_PX;
      const n = 'co' + ++cs;
      colStyles.push(
        `<style:style style:name="${n}" style:family="table-column"><style:table-column-properties style:column-width="${pxToIn(w)}"/></style:style>`,
      );
      colXml.push(`<table:table-column table:style-name="${n}"/>`);
    }
    for (let r = 0; r < rows; r++) {
      const cells: string[] = [];
      for (let c = 0; c < cols; c++) {
        if (covered.has(`${r},${c}`)) {
          cells.push('<table:covered-table-cell/>');
          continue;
        }
        const cell = sh.cellData?.[r]?.[c];
        const st = styleOf(snap, cell);
        const s = sty(st);
        const v = cellValue(cell);
        const sp = spans.get(`${r},${c}`);
        const at = `${s ? ` table:style-name="${s}"` : ''}${sp ? ` table:number-columns-spanned="${sp.cs}" table:number-rows-spanned="${sp.rs}"` : ''}${cell?.f ? ` table:formula="${escapeXml(formulaToOds(cell.f))}"` : ''}`;
        if (v === null) cells.push(`<table:table-cell${at}/>`);
        else if (typeof v === 'number')
          cells.push(
            `<table:table-cell${at} office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`,
          );
        else if (typeof v === 'boolean')
          cells.push(
            `<table:table-cell${at} office:value-type="boolean" office:boolean-value="${v}"><text:p>${v ? 'TRUE' : 'FALSE'}</text:p></table:table-cell>`,
          );
        else
          cells.push(
            `<table:table-cell${at} office:value-type="string"><text:p>${escapeXml(v).replace(/\n/g, '</text:p><text:p>')}</text:p></table:table-cell>`,
          );
      }
      const h = sh.rowData?.[r]?.h;
      out.push(`<table:table-row${h ? ` table:style-name="ro${h}"` : ''}>${cells.join('')}</table:table-row>`);
    }
    tables.push(
      `<table:table table:name="${escapeXml(sh.name)}">${colXml.join('')}${out.join('') || '<table:table-row><table:table-cell/></table:table-row>'}</table:table>`,
    );
  }
  const rowStyles = [...new Set([...tables.join('').matchAll(/style-name="ro(\d+)"/g)].map((m) => m[1]))].map(
    (h) =>
      `<style:style style:name="ro${h}" style:family="table-row"><style:table-row-properties style:row-height="${pxToIn(+h)}"/></style:style>`,
  );
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.2"><office:automatic-styles>${colStyles.join('')}${rowStyles.join('')}${styleXml.join('')}</office:automatic-styles><office:body><office:spreadsheet>${tables.join('')}</office:spreadsheet></office:body></office:document-content>`;
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet', { compression: 'STORE' });
  zip.file('content.xml', content);
  zip.file(
    'META-INF/manifest.xml',
    '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>',
  );
  return zip.generateAsync({ type: 'uint8array' });
}
const lenPx = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const m = /^([\d.]+)(cm|mm|in|pt|px)$/.exec(s);
  if (!m) return undefined;
  const n = +m[1];
  return Math.round(({ cm: 96 / 2.54, mm: 96 / 25.4, in: 96, pt: 96 / 72, px: 1 } as Record<string, number>)[m[2]] * n);
};
export async function odsToSnapshot(
  buf: ArrayBuffer | Uint8Array,
  name = 'Imported workbook',
): Promise<{ snap: Snap; warnings: string[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error("This doesn't look like a valid .ods file.");
  }
  const f = zip.file('content.xml');
  if (!f) throw new Error('The .ods file has no content.xml.');
  const root = parseXml(await f.async('string'));
  const warnings: string[] = [];
  // automatic styles -> Univer styles
  const auto = new Map<string, Style>();
  const colW = new Map<string, number>();
  const rowH = new Map<string, number>();
  for (const s of findAll(root, 'style:style')) {
    const nm = s.attrs['style:name'];
    const fam = s.attrs['style:family'];
    const tcp = child(s, 'style:table-cell-properties'),
      tp = child(s, 'style:text-properties'),
      pp = child(s, 'style:paragraph-properties');
    if (fam === 'table-column') {
      const w = lenPx(child(s, 'style:table-column-properties')?.attrs['style:column-width']);
      if (w) colW.set(nm, w);
      continue;
    }
    if (fam === 'table-row') {
      const h = lenPx(child(s, 'style:table-row-properties')?.attrs['style:row-height']);
      if (h) rowH.set(nm, h);
      continue;
    }
    if (fam !== 'table-cell') continue;
    const st: Style = {};
    if (tp?.attrs['fo:font-weight'] === 'bold') st.bl = 1;
    if (tp?.attrs['fo:font-style'] === 'italic') st.it = 1;
    if (tp && tp.attrs['style:text-underline-style'] && tp.attrs['style:text-underline-style'] !== 'none')
      st.ul = { s: 1 };
    if (tp && tp.attrs['style:text-line-through-style'] && tp.attrs['style:text-line-through-style'] !== 'none')
      st.st = { s: 1 };
    const col = tp?.attrs['fo:color'];
    if (col && /^#[0-9a-f]{6}$/i.test(col) && col !== '#000000') st.cl = { rgb: col.toLowerCase() };
    const fs = tp?.attrs['fo:font-size'];
    if (fs) {
      const n = parseFloat(fs);
      if (n && n !== 10 && n !== 11) st.fs = n;
    }
    const bg = tcp?.attrs['fo:background-color'];
    if (bg && /^#[0-9a-f]{6}$/i.test(bg)) st.bg = { rgb: bg.toLowerCase() };
    if (tcp?.attrs['fo:wrap-option'] === 'wrap') st.tb = 3;
    const va = tcp?.attrs['style:vertical-align'];
    if (va === 'top') st.vt = 1;
    else if (va === 'middle') st.vt = 2;
    else if (va === 'bottom') st.vt = 3;
    const ta = pp?.attrs['fo:text-align'];
    if (ta === 'start' || ta === 'left') st.ht = 1;
    else if (ta === 'center') st.ht = 2;
    else if (ta === 'end' || ta === 'right') st.ht = 3;
    auto.set(nm, st);
  }
  const styles: Record<string, Style> = {};
  const sheets: Record<string, SheetSnap> = {};
  const order: string[] = [];
  const sid = (st: Style): string | undefined => {
    if (!Object.keys(st).length) return undefined;
    const k = 'o' + JSON.stringify(st);
    styles[k] = st;
    return k;
  };
  for (const t of findAll(root, 'table:table')) {
    const id = nextId();
    order.push(id);
    const cellData: Record<string, Record<string, Cell>> = {};
    const mergeData: NonNullable<SheetSnap['mergeData']> = [];
    const columnData: NonNullable<SheetSnap['columnData']> = {};
    const rowData: NonNullable<SheetSnap['rowData']> = {};
    let ci = 0;
    for (const k of t.kids) {
      if (k.tag === 'table:table-column') {
        const rep = Math.min(+(k.attrs['table:number-columns-repeated'] ?? 1), 200);
        const w = colW.get(k.attrs['table:style-name'] ?? '');
        for (let i = 0; i < rep; i++, ci++) if (w) columnData[ci] = { w };
      }
    }
    let r = 0,
      maxR = 0,
      maxC = 0;
    const rowNodes = t.kids.flatMap((k) =>
      k.tag === 'table:table-row'
        ? [k]
        : k.tag.startsWith('table:table-row-group') || k.tag === 'table:table-header-rows'
          ? k.kids.filter((x) => x.tag === 'table:table-row')
          : [],
    );
    for (const row of rowNodes) {
      const rrep = +(row.attrs['table:number-rows-repeated'] ?? 1);
      const cells = row.kids.filter((x) => x.tag === 'table:table-cell' || x.tag === 'table:covered-table-cell');
      const hasContent = cells.some(
        (c) =>
          c.attrs['office:value-type'] ||
          c.attrs['table:formula'] ||
          c.attrs['table:style-name'] ||
          c.attrs['table:number-columns-spanned'] ||
          c.attrs['table:number-rows-spanned'],
      );
      if (!hasContent) {
        r += rrep;
        continue;
      }
      const reps = Math.min(rrep, 1000);
      const h = rowH.get(row.attrs['table:style-name'] ?? '');
      for (let rr = 0; rr < reps; rr++, r++) {
        if (h) rowData[r] = { h };
        let c = 0;
        for (const cn of cells) {
          const crep = +(cn.attrs['table:number-columns-repeated'] ?? 1);
          if (cn.tag === 'table:covered-table-cell') {
            c += crep;
            continue;
          }
          const vt = cn.attrs['office:value-type'];
          const fm = cn.attrs['table:formula'];
          const stName = cn.attrs['table:style-name'];
          const base = stName ? (auto.get(stName) ?? {}) : {};
          const cell: Cell = {};
          let st: Style = { ...base };
          const txt = cn.kids
            .filter((x) => x.tag === 'text:p')
            .map((p) => textOf(p))
            .join('\n');
          if (vt === 'float' || vt === 'percentage' || vt === 'currency') {
            cell.v = +(cn.attrs['office:value'] ?? 0);
            cell.t = 2;
            if (vt === 'percentage') st.n = { pattern: '0%' };
            if (vt === 'currency') st.n = { pattern: '$#,##0.00' };
          } else if (vt === 'boolean') {
            cell.v = cn.attrs['office:boolean-value'] === 'true' ? 1 : 0;
            cell.t = 3;
          } else if (vt === 'date') {
            const d = cn.attrs['office:date-value'] ?? '';
            const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/.exec(d);
            if (m) {
              cell.v = dateToSerial(
                new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))),
              );
              cell.t = 2;
              st.n = { pattern: m[4] ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd' };
            }
          } else if (vt === 'time') {
            const m = /^PT(\d+)H(\d+)M([\d.]+)S$/.exec(cn.attrs['office:time-value'] ?? '');
            if (m) {
              cell.v = (+m[1] * 3600 + +m[2] * 60 + +m[3]) / 86400;
              cell.t = 2;
              st.n = { pattern: 'hh:mm:ss' };
            }
          } else if (vt === 'string') {
            cell.v = cn.attrs['office:string-value'] ?? txt;
            cell.t = 1;
          }
          if (fm) cell.f = formulaFromOds(fm);
          const s = sid(st);
          if (s) cell.s = s;
          const empty = cell.v === undefined && !cell.f && !cell.s;
          if (!empty) {
            const n = Math.min(crep, 200);
            for (let i = 0; i < n; i++) {
              (cellData[r] ??= {})[c + i] = { ...cell };
            }
            maxR = Math.max(maxR, r + 1);
            maxC = Math.max(maxC, c + n);
          }
          const cspan = +(cn.attrs['table:number-columns-spanned'] ?? 1),
            rspan = +(cn.attrs['table:number-rows-spanned'] ?? 1);
          if (cspan > 1 || rspan > 1)
            mergeData.push({ startRow: r, startColumn: c, endRow: r + rspan - 1, endColumn: c + cspan - 1 });
          c += crep;
        }
      }
    }
    sheets[id] = {
      id,
      name: t.attrs['table:name'] || `Sheet${order.length}`,
      rowCount: Math.max(1000, maxR + 100),
      columnCount: Math.max(26, maxC + 10),
      cellData,
      mergeData,
      columnData,
      rowData,
      defaultColumnWidth: DEFAULT_COL_PX,
      defaultRowHeight: DEFAULT_ROW_PX,
    };
  }
  if (!order.length) throw new Error('The .ods file has no sheets.');
  if (/<table:content-validations|<calcext:conditional-formats/.test(await f.async('string')))
    warnings.push('Data validation or conditional formats in the file were not imported.');
  return { snap: { id: '', name, locale: 'enUS', sheetOrder: order, sheets, styles, resources: [] } as Snap, warnings };
}
export { colName };

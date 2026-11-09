// Hyperlinks, document links and web-data helpers (v95). Pure.
export type LinkKind = 'web' | 'mail' | 'tel' | 'sheet' | 'range' | 'name' | 'file' | 'unsafe' | 'unknown';
export interface LinkInfo {
  kind: LinkKind;
  url: string;
  sheetId?: string;
  range?: string;
  rangeId?: string;
}
const SAFE = /^(https?:|mailto:|tel:)/i;
/** Clean what a person typed into a URL; refuses script-like schemes. */
export function normalizeUrl(input: string): { ok: true; url: string } | { ok: false; reason: string } {
  const t = input.trim();
  if (!t) return { ok: false, reason: 'Enter an address' };
  if (/^(javascript|data|vbscript|file|blob):/i.test(t))
    return { ok: false, reason: 'That kind of link isn’t allowed' };
  if (t.startsWith('#')) return { ok: true, url: t };
  if (SAFE.test(t)) {
    if (/^https?:\/\/\S+@/i.test(t) && /^https?:\/\/[^/]*:[^/]*@/i.test(t))
      return { ok: false, reason: 'Links with a password in them aren’t allowed' };
    return { ok: true, url: t };
  }
  if (/^[^\s@/]+@[^\s@/]+\.[A-Za-z]{2,}$/.test(t)) return { ok: true, url: 'mailto:' + t };
  if (/^\+?[\d\s().-]{6,}$/.test(t)) return { ok: true, url: 'tel:' + t.replace(/[^\d+]/g, '') };
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(t)) return { ok: false, reason: 'Use http, https, mailto or tel links' };
  if (/^[^\s/]+\.[A-Za-z]{2,}([/?#]\S*)?$/.test(t)) return { ok: true, url: 'https://' + t };
  return { ok: false, reason: 'That doesn’t look like a web address or email' };
}
export const sheetLink = (sheetId: string, a1?: string) =>
  `#gid=${sheetId}${a1 ? `&range=${a1.replace(/\$/g, '')}` : ''}`;
export function classify(url: string): LinkInfo {
  const u = String(url ?? '').trim();
  if (u.startsWith('#')) {
    const q = new URLSearchParams(u.slice(1));
    const gid = q.get('gid') ?? undefined;
    const range = q.get('range') ?? undefined;
    const rangeid = q.get('rangeid') ?? undefined;
    const kind: LinkKind = range
      ? /^[A-Za-z]{1,3}\d+(:[A-Za-z]{1,3}\d+)?$/.test(range)
        ? 'range'
        : 'name'
      : gid
        ? 'sheet'
        : rangeid
          ? 'name'
          : 'unknown';
    return { kind, url: u, sheetId: gid, range, rangeId: rangeid };
  }
  if (/^https?:/i.test(u)) return { kind: 'web', url: u };
  if (/^mailto:/i.test(u)) return { kind: 'mail', url: u };
  if (/^tel:/i.test(u)) return { kind: 'tel', url: u };
  if (/^(javascript|data|vbscript|file|blob):/i.test(u)) return { kind: 'unsafe', url: u };
  return { kind: 'unknown', url: u };
}
export const kindLabel = (k: LinkKind) =>
  ({
    web: 'Web page',
    mail: 'Email',
    tel: 'Phone',
    sheet: 'Sheet',
    range: 'Cell / range',
    name: 'Named range',
    file: 'File',
    unsafe: 'Blocked',
    unknown: 'Other',
  })[k];
export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};
/** Which internal links point at sheets that no longer exist. */
export function brokenInternal(
  links: Array<{ url: string }>,
  sheetIds: Set<string>,
): Array<{ url: string; reason: string }> {
  const out: Array<{ url: string; reason: string }> = [];
  for (const l of links) {
    const c = classify(l.url);
    if ((c.kind === 'sheet' || c.kind === 'range') && c.sheetId && !sheetIds.has(c.sheetId))
      out.push({ url: l.url, reason: 'The sheet it points to no longer exists' });
  }
  return out;
}
/** Text from a web response -> a grid. CSV/TSV, JSON (array of objects / {data:[…]}), or the first table in an HTML page. */
export type Cellv = string | number | boolean | null;
export function sniffFormat(text: string, contentType = ''): 'json' | 'html' | 'csv' | 'tsv' {
  const t = text.trimStart();
  if (/json/i.test(contentType) || t.startsWith('[') || t.startsWith('{')) return 'json';
  if (/html/i.test(contentType) || /^<(!doctype|html|table|body|head)/i.test(t)) return 'html';
  const first = t.split('\n', 1)[0] ?? '';
  return first.includes('\t') && !first.includes(',') ? 'tsv' : 'csv';
}
/** Extract the first (or n-th) <table> of an HTML string into plain text cells. */
export function htmlTable(html: string, nth = 0): string[][] | null {
  const tables = html.match(/<table[\s\S]*?(?:<\/table>|$)/gi);
  if (!tables || !tables[nth]) return null;
  const dec = (s: string) =>
    s
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(+d))
      .replace(/\s+/g, ' ')
      .trim();
  const rows = tables[nth].split(/<tr(?=[\s>])/i).slice(1);
  return rows
    .map((r) =>
      r
        .split(/<t[hd](?=[\s>])/i)
        .slice(1)
        .map((c) => dec(c.replace(/^[^>]*>/, '').replace(/<\/t[hd]>[\s\S]*$/i, ''))),
    )
    .filter((r) => r.length);
}
export function tableCount(html: string) {
  return (html.match(/<table[\s>]/gi) ?? []).length;
}
/** Interpret a cell string as number/boolean when it clearly is one (so web data sums, sorts, charts). */
export function typed(s: string): Cellv {
  const t = s.trim();
  if (t === '') return null;
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  if (/^[-+]?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/.test(t) && !/^0\d/.test(t.replace(/,/g, '')))
    return Number(t.replace(/,/g, ''));
  return s;
}
export const isPrivateHost = (url: string): boolean => {
  const h = hostOf(url).split(':')[0].toLowerCase();
  return (
    h === 'localhost' ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    h === '[::1]'
  );
};
export function checkWebUrl(u: string): { ok: true; url: string } | { ok: false; reason: string } {
  const n = normalizeUrl(u);
  if (!n.ok) return n;
  if (!/^https?:/i.test(n.url)) return { ok: false, reason: 'Data connections need an http or https address' };
  return n;
}

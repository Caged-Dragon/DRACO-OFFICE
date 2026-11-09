// Regional formats (v98): number / date / currency formatting + parsing per region, formula list separators. Pure.
export interface Region {
  id: string;
  label: string;
  decimal: string;
  thousand: string;
  indian?: boolean;
  listSep: ',' | ';';
  dateOrder: 'MDY' | 'DMY' | 'YMD';
  dateSep: string;
  currency: { symbol: string; after: boolean; code: string };
  firstDay: 0 | 1 | 6;
  rtl?: boolean;
  ui?: string;
  pattern: string;
}
export const REGIONS: Region[] = [
  {
    id: 'en-US',
    label: 'English (United States)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'MDY',
    dateSep: '/',
    currency: { symbol: '$', after: false, code: 'USD' },
    firstDay: 0,
    ui: 'enUS',
    pattern: 'm/d/yyyy',
  },
  {
    id: 'en-GB',
    label: 'English (United Kingdom)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: '£', after: false, code: 'GBP' },
    firstDay: 1,
    ui: 'enUS',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'en-IN',
    label: 'English (India)',
    decimal: '.',
    thousand: ',',
    indian: true,
    listSep: ',',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: '₹', after: false, code: 'INR' },
    firstDay: 0,
    ui: 'enUS',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'hi-IN',
    label: 'हिन्दी (India)',
    decimal: '.',
    thousand: ',',
    indian: true,
    listSep: ',',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: '₹', after: false, code: 'INR' },
    firstDay: 0,
    ui: 'enUS',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'de-DE',
    label: 'Deutsch (Deutschland)',
    decimal: ',',
    thousand: '.',
    listSep: ';',
    dateOrder: 'DMY',
    dateSep: '.',
    currency: { symbol: '€', after: true, code: 'EUR' },
    firstDay: 1,
    ui: 'deDE',
    pattern: 'dd.mm.yyyy',
  },
  {
    id: 'fr-FR',
    label: 'Français (France)',
    decimal: ',',
    thousand: ' ',
    listSep: ';',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: '€', after: true, code: 'EUR' },
    firstDay: 1,
    ui: 'frFR',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'es-ES',
    label: 'Español (España)',
    decimal: ',',
    thousand: '.',
    listSep: ';',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: '€', after: true, code: 'EUR' },
    firstDay: 1,
    ui: 'esES',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'it-IT',
    label: 'Italiano (Italia)',
    decimal: ',',
    thousand: '.',
    listSep: ';',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: '€', after: true, code: 'EUR' },
    firstDay: 1,
    ui: 'itIT',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'pt-BR',
    label: 'Português (Brasil)',
    decimal: ',',
    thousand: '.',
    listSep: ';',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: 'R$', after: false, code: 'BRL' },
    firstDay: 0,
    ui: 'ptBR',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'ru-RU',
    label: 'Русский (Россия)',
    decimal: ',',
    thousand: ' ',
    listSep: ';',
    dateOrder: 'DMY',
    dateSep: '.',
    currency: { symbol: '₽', after: true, code: 'RUB' },
    firstDay: 1,
    ui: 'ruRU',
    pattern: 'dd.mm.yyyy',
  },
  {
    id: 'ja-JP',
    label: '日本語 (日本)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'YMD',
    dateSep: '/',
    currency: { symbol: '¥', after: false, code: 'JPY' },
    firstDay: 0,
    ui: 'jaJP',
    pattern: 'yyyy/mm/dd',
  },
  {
    id: 'zh-CN',
    label: '简体中文 (中国)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'YMD',
    dateSep: '-',
    currency: { symbol: '¥', after: false, code: 'CNY' },
    firstDay: 1,
    ui: 'zhCN',
    pattern: 'yyyy-mm-dd',
  },
  {
    id: 'ko-KR',
    label: '한국어 (대한민국)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'YMD',
    dateSep: '.',
    currency: { symbol: '₩', after: false, code: 'KRW' },
    firstDay: 0,
    ui: 'koKR',
    pattern: 'yyyy.mm.dd',
  },
  {
    id: 'ar-SA',
    label: 'العربية (السعودية)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'DMY',
    dateSep: '/',
    currency: { symbol: 'ر.س.', after: true, code: 'SAR' },
    firstDay: 6,
    rtl: true,
    ui: 'arSA',
    pattern: 'dd/mm/yyyy',
  },
  {
    id: 'fa-IR',
    label: 'فارسی (ایران)',
    decimal: '.',
    thousand: ',',
    listSep: ',',
    dateOrder: 'YMD',
    dateSep: '/',
    currency: { symbol: '﷼', after: true, code: 'IRR' },
    firstDay: 6,
    rtl: true,
    ui: 'faIR',
    pattern: 'yyyy/mm/dd',
  },
];
export const regionById = (id: string): Region => REGIONS.find((r) => r.id === id) ?? REGIONS[0];
const groupStd = (s: string, sep: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const groupIndian = (s: string, sep: string) =>
  s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, sep) + sep + s.slice(-3);
export function formatNumber(n: number, r: Region, decimals = 2, grouped = true): string {
  if (!Number.isFinite(n)) return String(n);
  const neg = n < 0;
  const [ip, fp = ''] = Math.abs(n).toFixed(decimals).split('.');
  const g = !grouped ? ip : r.indian ? groupIndian(ip, r.thousand) : groupStd(ip, r.thousand);
  const out = g + (decimals > 0 ? r.decimal + fp : '');
  return (neg && Number(Math.abs(n).toFixed(decimals)) !== 0 ? '-' : '') + out;
}
export function formatCurrency(
  n: number,
  r: Region,
  decimals = r.currency.code === 'JPY' || r.currency.code === 'KRW' ? 0 : 2,
): string {
  const body = formatNumber(Math.abs(n), r, decimals);
  const s = r.currency.after ? `${body} ${r.currency.symbol}` : `${r.currency.symbol}${body}`;
  return n < 0 ? `-${s}` : s;
}
const p2 = (n: number) => String(n).padStart(2, '0');
export function serialToYmd(serial: number): { y: number; m: number; d: number } {
  const dt = new Date(Math.round((serial - 25569) * 86400000));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
export const ymdToSerial = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
export function formatDate(serial: number, r: Region): string {
  const { y, m, d } = serialToYmd(serial);
  const s = r.dateSep;
  return r.dateOrder === 'MDY'
    ? `${m}${s}${d}${s}${y}`
    : r.dateOrder === 'DMY'
      ? `${p2(d)}${s}${p2(m)}${s}${y}`
      : `${y}${s}${p2(m)}${s}${p2(d)}`;
}
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩',
  FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const normalizeDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c)))
    .replace(/[٫]/g, ',')
    .replace(/[٬]/g, '.');
/** Parse text typed in a region's style into a number: "1.234,56", "₹1,23,456.78", "(12,5)", "12 %", "−3". Null when it isn't a number. */
export function parseNumber(text: string, r: Region): number | null {
  let t = normalizeDigits(text).trim().replace(/−/g, '-');
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  let pct = false;
  if (/%$/.test(t)) {
    pct = true;
    t = t.slice(0, -1);
  }
  t = t
    .replace(
      new RegExp(
        `^[-+]?\\s*(${[r.currency.symbol, '$', '€', '£', '¥', '₹', '₩', '₽', 'R\\$'].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*`,
      ),
      (m) => (m.trim().startsWith('-') ? '-' : ''),
    )
    .replace(/\s*(€|£|¥|₹|₩|₽|ر\.س\.|﷼|zł|kr)$/, '')
    .trim();
  if (t.startsWith('-')) {
    neg = !neg;
    t = t.slice(1).trim();
  } else if (t.startsWith('+')) t = t.slice(1).trim();
  if (t.endsWith('-')) {
    neg = !neg;
    t = t.slice(0, -1).trim();
  }
  const th =
    r.thousand === ' ' || r.thousand === ' '
      ? '[\\s\\u202f\\u00a0]'
      : r.thousand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const dec = r.decimal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const std = new RegExp(`^\\d{1,3}(${th}\\d{3})+(${dec}\\d+)?$`),
    ind = new RegExp(`^\\d{1,2}(${th}\\d{2})*${th}\\d{3}(${dec}\\d+)?$`),
    plain = new RegExp(`^\\d*${dec}?\\d+$|^\\d+${dec}$`);
  if (!(std.test(t) || (r.indian && ind.test(t)) || plain.test(t))) return null;
  const clean = t.replace(new RegExp(th, 'g'), '').replace(r.decimal, '.');
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  const v = pct ? n / 100 : n;
  return neg ? -v : v;
}
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
/** Parse "31/12/2024", "12/31/2024", "2024-12-31", "5 Mar 2024" using the region's day/month order. Returns an Excel serial. */
export function parseDate(text: string, r: Region): number | null {
  const t = normalizeDigits(text).trim();
  if (!t) return null;
  let m: RegExpExecArray | null;
  const ok = (y: number, mo: number, d: number) => {
    if (y < 100) y += y < 30 ? 2000 : 1900;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const s = ymdToSerial(y, mo, d);
    const c = serialToYmd(s);
    return c.y === y && c.m === mo && c.d === d ? s : null;
  };
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t))) return ok(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(t))) {
    const a = +m[1],
      b = +m[2],
      y = +m[3];
    if (r.dateOrder === 'MDY') return ok(y, a, b);
    if (r.dateOrder === 'DMY') return ok(y, b, a);
    return ok(y, b, a);
  }
  if ((m = /^(\d{1,2})[ -]([A-Za-z]{3,9})\.?[ -,]*(\d{2}|\d{4})$/.exec(t))) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mo ? ok(+m[3], mo, +m[1]) : null;
  }
  if ((m = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{2}|\d{4})$/.exec(t))) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mo ? ok(+m[3], mo, +m[2]) : null;
  }
  return null;
}
/** Swap list separators in a formula (",": en-US, ";": most of Europe) and decimal commas, leaving text in quotes alone. */
export function convertFormula(f: string, from: Region, to: Region): string {
  if (from.listSep === to.listSep && from.decimal === to.decimal) return f;
  let out = '';
  let q = false;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (ch === '"') {
      q = !q;
      out += ch;
      continue;
    }
    if (q) {
      out += ch;
      continue;
    }
    if (ch === from.listSep && !(from.listSep === ',' && from.decimal === ',')) {
      out += to.listSep;
      continue;
    }
    if (ch === from.decimal && /\d/.test(f[i - 1] ?? '') && /\d/.test(f[i + 1] ?? '')) {
      out += to.decimal;
      continue;
    }
    out += ch;
  }
  return out;
}
export function sample(r: Region, now = 45000.5): Array<[string, string]> {
  return [
    ['Number', formatNumber(1234567.891, r)],
    ['Currency', formatCurrency(-1234.5, r)],
    ['Date', formatDate(now, r)],
    ['Formula', convertFormula('=SUM(1.5,2)', REGIONS[0], r)],
  ];
}

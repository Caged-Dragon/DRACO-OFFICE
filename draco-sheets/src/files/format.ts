// Small Excel number-format renderer (enough to print / export what the grid shows) — v80/v81.
import { serialToDate } from './model';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const p2 = (n: number) => String(n).padStart(2, '0');

export function isDatePattern(p: string): boolean {
  const s = p
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]*\]/g, (m) => (/^\[(h+|m+|s+)\]$/i.test(m) ? 'h' : ''));
  return /[ymdhs]/i.test(s) && !/[#0?]/.test(s.replace(/0+\.0+/g, ''));
}
export function formatDate(serial: number, pattern: string): string {
  const d = serialToDate(serial);
  const Y = d.getUTCFullYear(),
    M = d.getUTCMonth(),
    D = d.getUTCDate(),
    W = d.getUTCDay();
  let h = d.getUTCHours(),
    mi = d.getUTCMinutes();
  const sec = d.getUTCSeconds();
  const ampm = /AM\/PM|A\/P/i.test(pattern);
  const toks =
    pattern.match(/"[^"]*"|\\.|\[[^\]]*\]|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P|\.0+|./gi) ??
    [];
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const l = t.toLowerCase();
    if (t[0] === '"') out += t.slice(1, -1);
    else if (t[0] === '\\') out += t[1];
    else if (t[0] === '[') {
      const k = l.slice(1, -1);
      const total = Math.round(serial * 86400);
      out +=
        k[0] === 'h'
          ? String(Math.floor(total / 3600)).padStart(k.length, '0')
          : k[0] === 'm'
            ? String(Math.floor(total / 60)).padStart(k.length, '0')
            : String(total).padStart(k.length, '0');
    } else if (l === 'yyyy') out += String(Y).padStart(4, '0');
    else if (l === 'yy') out += p2(Y % 100);
    else if (l === 'mmmmm') out += MONTHS[M][0];
    else if (l === 'mmmm') out += MONTHS[M];
    else if (l === 'mmm') out += MONTHS[M].slice(0, 3);
    else if (l === 'mm' || l === 'm') {
      const dt = (x: string) => /^(\[h+\]|h+|y+|d+|m+|s+|\[m+\]|\[s+\])$/i.test(x);
      const prevT = [...toks.slice(0, i)].reverse().find(dt);
      const nextT = toks.slice(i + 1).find(dt);
      const isMin = (!!prevT && /^(\[h+\]|h+)$/i.test(prevT)) || (!!nextT && /^s+$/i.test(nextT));
      out += isMin ? (l === 'mm' ? p2(mi) : String(mi)) : l === 'mm' ? p2(M + 1) : String(M + 1);
    } else if (l === 'dddd') out += DAYS[W];
    else if (l === 'ddd') out += DAYS[W].slice(0, 3);
    else if (l === 'dd') out += p2(D);
    else if (l === 'd') out += String(D);
    else if (l === 'hh' || l === 'h') {
      const hh = ampm ? h % 12 || 12 : h;
      out += l === 'hh' ? p2(hh) : String(hh);
    } else if (l === 'ss') out += p2(sec);
    else if (l === 's') out += String(sec);
    else if (l === 'am/pm') out += h < 12 ? 'AM' : 'PM';
    else if (l === 'a/p') out += h < 12 ? 'A' : 'P';
    else if (/^\.0+$/.test(l))
      out += '.' + String(Math.round(((serial * 86400) % 1) * 10 ** (l.length - 1))).padStart(l.length - 1, '0');
    else out += t;
  }
  void mi;
  void h;
  return out;
}
const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function generalNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e11 || a < 1e-9) {
    const e = v.toExponential(5).replace(/\.?0+e/, 'e');
    return e.replace(/e([+-])(\d)$/, 'E$10$2').replace(/e([+-])(\d\d)/, 'E$1$2');
  }
  let s = Number(v.toPrecision(10)).toString();
  if (s.includes('e')) s = v.toFixed(10).replace(/\.?0+$/, '');
  return s;
}
export function formatNumber(v: number, pattern: string | undefined): string {
  if (!pattern || /^general$/i.test(pattern)) return generalNumber(v);
  const secs = pattern.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  let sec = secs[0];
  let val = v;
  if (v < 0 && secs.length > 1) {
    sec = secs[1];
    val = -v;
  } else if (v === 0 && secs.length > 2) sec = secs[2];
  sec = sec
    .replace(/\[(?:Red|Blue|Green|Black|White|Cyan|Magenta|Yellow|Color\d+)\]/gi, '')
    .replace(/\[\$([^\]-]*)(?:-[^\]]*)?\]/g, '"$1"');
  if (isDatePattern(sec)) return formatDate(val, sec);
  if (/^@$/.test(sec)) return String(v);
  const lits: string[] = [];
  const core = sec.replace(/"([^"]*)"|\\(.)|(_.)|(\*.)/g, (_m, q, e, sp) => {
    if (sp) return ' ';
    const x = q ?? e ?? '';
    if (_m.startsWith('*')) return '';
    lits.push(x);
    return `\u0001${String.fromCharCode(0xe000 + lits.length - 1)}\u0002`;
  });
  const pct = (core.match(/%/g) ?? []).length;
  if (pct) val *= 100 ** pct;
  const m = /[#0?][#0?,]*(?:\.[0#?]+)?(?:E[+-]0+)?/i.exec(core);
  const out = (body: string) =>
    core
      .replace(/%/g, '%')
      .replace(/\u0001(.)\u0002/g, (_x, i: string) => lits[i.charCodeAt(0) - 0xe000])
      .replace(m ? m[0] : '\u0000', body)
      .replace(/\u0001(.)\u0002/g, (_x, i: string) => lits[i.charCodeAt(0) - 0xe000]);
  const neg = v < 0 && secs.length === 1;
  if (!m) return (neg ? '-' : '') + out('');
  const spec = m[0];
  const sci = /E[+-]0+$/i.exec(spec);
  if (sci) {
    const dec = (spec.split('.')[1] ?? '').replace(/E.*/i, '').length;
    const [mant, ex] = Math.abs(val).toExponential(dec).split('e');
    const en = parseInt(ex, 10);
    return (
      (neg ? '-' : '') + out(`${mant}E${en < 0 ? '-' : '+'}${String(Math.abs(en)).padStart(sci[0].length - 2, '0')}`)
    );
  }
  const dec = (spec.split('.')[1] ?? '').length;
  const th = spec.includes(',');
  const trailingCommas = /[#0?](,+)(?:\.|$)/.exec(spec.replace(/,(?=[#0?])/g, 'x'));
  if (trailingCommas && !spec.includes('.')) val /= 1000 ** trailingCommas[1].length;
  const fixed = Math.abs(val).toFixed(dec);
  let [ip, fp = ''] = fixed.split('.');
  const minInt = (spec.split('.')[0].match(/0/g) ?? []).length;
  ip = ip.padStart(minInt, '0');
  if (minInt === 0 && ip === '0' && dec > 0 && /^#/.test(spec)) ip = '';
  if (th) ip = group(ip);
  const optional = (spec.split('.')[1] ?? '').replace(/0/g, '').length;
  if (optional) fp = fp.replace(new RegExp(`0{0,${optional}}$`), '');
  const body = ip + (fp ? '.' + fp : dec > 0 && /\.0*$/.test(spec) && !optional ? '' : '');
  const isZero = Number(fixed) === 0;
  return (neg && !isZero ? '-' : '') + out(body);
}
export function displayText(v: string | number | boolean | null | undefined, pattern?: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  return formatNumber(v, pattern);
}

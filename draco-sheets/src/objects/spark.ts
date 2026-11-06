// Sparklines (v69): tiny cell-sized charts. Pure SVG.
import { isNum } from '../charts/math';
import { maxOf, minOf } from '../safeMath';
export interface SparkOpts { kind: 'line' | 'column' | 'winloss'; color?: string; negColor?: string; markers?: boolean; high?: boolean; low?: boolean; first?: boolean; last?: boolean; negative?: boolean; axis?: boolean; emptyAs?: 'gap' | 'zero'; min?: number; max?: number }
const f = (n: number) => (Math.round(n * 100) / 100).toString();
export function renderSparkline(values: Array<number | null>, o: SparkOpts, W = 120, H = 28): string {
  const color = o.color ?? '#4472C4', neg = o.negColor ?? '#D1495B'; const pad = 3;
  const vals = values.map((v) => (isNum(v) ? v : o.emptyAs === 'zero' ? 0 : null)); const nums = vals.filter(isNum) as number[];
  const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="sparkline">${inner}</svg>`;
  if (!nums.length) return svg('');
  let lo = o.min ?? minOf(nums), hi = o.max ?? maxOf(nums); if (o.kind === 'column') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } if (lo === hi) { lo -= 1; hi += 1; }
  const n = vals.length; const iw = W - pad * 2, ih = H - pad * 2; const x = (i: number) => pad + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); const y = (v: number) => pad + ih - ((v - lo) / (hi - lo)) * ih;
  const hiI = vals.indexOf(maxOf(nums)), loI = vals.indexOf(minOf(nums)); const lastI = vals.length - 1 - [...vals].reverse().findIndex(isNum), firstI = vals.findIndex(isNum);
  const out: string[] = [];
  if (o.axis && lo < 0 && hi > 0) out.push(`<line x1="${pad}" x2="${W - pad}" y1="${f(y(0))}" y2="${f(y(0))}" stroke="#999" stroke-width="0.6"/>`);
  if (o.kind === 'line') {
    let d = '', pen = false; vals.forEach((v, i) => { if (!isNum(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${f(x(i))} ${f(y(v))}`; pen = true; });
    out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`);
    const dot = (i: number, c: string) => (isNum(vals[i]) ? `<circle cx="${f(x(i))}" cy="${f(y(vals[i] as number))}" r="2.4" fill="${c}"/>` : '');
    if (o.markers) vals.forEach((_, i) => out.push(dot(i, color)));
    if (o.first) out.push(dot(firstI, '#F3A712')); if (o.last) out.push(dot(lastI, '#F3A712')); if (o.high) out.push(dot(hiI, '#2D936C')); if (o.low) out.push(dot(loI, '#D1495B'));
    if (o.negative) vals.forEach((v, i) => { if (isNum(v) && v < 0) out.push(dot(i, neg)); });
  } else {
    const bw = Math.max(1, (iw / n) * 0.7); const y0 = y(Math.max(lo, Math.min(hi, 0)));
    vals.forEach((v, i) => {
      if (!isNum(v)) return; const cx = pad + ((i + 0.5) / n) * iw;
      let c = v < 0 && o.negative !== false ? neg : color; if (o.high && i === hiI) c = '#2D936C'; if (o.low && i === loI) c = '#D1495B'; if (o.first && i === firstI) c = '#F3A712'; if (o.last && i === lastI) c = '#F3A712';
      if (o.kind === 'winloss') { const up = v > 0, flat = v === 0; const h = flat ? 1 : ih / 2 - 1; out.push(`<rect x="${f(cx - bw / 2)}" y="${f(up ? H / 2 - h : H / 2 + (flat ? -0.5 : 1))}" width="${f(bw)}" height="${f(h)}" fill="${v < 0 ? neg : color}"/>`); }
      else out.push(`<rect x="${f(cx - bw / 2)}" y="${f(Math.min(y(v), y0))}" width="${f(bw)}" height="${f(Math.max(1, Math.abs(y(v) - y0)))}" fill="${c}"/>`);
    });
    if (o.kind === 'winloss') out.push(`<line x1="${pad}" x2="${W - pad}" y1="${H / 2}" y2="${H / 2}" stroke="#bbb" stroke-width="0.5"/>`);
  }
  return svg(out.join(''));
}

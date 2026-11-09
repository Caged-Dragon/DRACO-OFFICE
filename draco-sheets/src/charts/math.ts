import { maxOf, minOf } from '../formulas/safeMath';
// Numeric helpers for charts (v61-v67). Pure, unit-tested in Node.
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
export const clean = (a: Array<number | null | undefined>): number[] => a.filter(isNum) as number[];

/** Sample (n-1) or population standard deviation. */
export function stdev(a: number[], sample = true): number {
  if (a.length < (sample ? 2 : 1)) return 0;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - (sample ? 1 : 0)));
}
/** Percentile with Excel's PERCENTILE.INC rule. p in [0,1]. */
export function percentileInc(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const k = (sorted.length - 1) * p,
    f = Math.floor(k),
    c = Math.min(f + 1, sorted.length - 1);
  return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
}
/** Percentile with Excel's PERCENTILE.EXC rule (returns NaN if out of range). */
export function percentileExc(sorted: number[], p: number): number {
  const n = sorted.length;
  const k = p * (n + 1);
  if (k < 1 || k > n) return NaN;
  const f = Math.floor(k);
  return sorted[f - 1] + (sorted[Math.min(f, n - 1)] - sorted[f - 1]) * (k - f);
}
export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  outliers: number[];
  lowFence: number;
  highFence: number;
}
/** Box & whisker stats (Excel: inclusive or exclusive median; whiskers reach the furthest points within 1.5 IQR). */
export function boxStats(values: number[], method: 'inclusive' | 'exclusive' = 'inclusive'): BoxStats | null {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const q = (p: number) => {
    const v = method === 'inclusive' ? percentileInc(s, p) : percentileExc(s, p);
    return Number.isNaN(v) ? percentileInc(s, p) : v;
  };
  const q1 = q(0.25),
    median = q(0.5),
    q3 = q(0.75),
    iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr,
    highFence = q3 + 1.5 * iqr;
  const inside = s.filter((x) => x >= lowFence && x <= highFence);
  return {
    min: inside[0],
    q1,
    median,
    q3,
    max: inside[inside.length - 1],
    mean: mean(s),
    outliers: s.filter((x) => x < lowFence || x > highFence),
    lowFence,
    highFence,
  };
}

/** "Nice" axis: round min/max outward to a step of 1, 2, 2.5, 5 x 10^n so that ~`target` ticks fit. */
export function niceScale(
  min: number,
  max: number,
  target = 6,
): { min: number; max: number; step: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    if (min === 0) {
      max = 1;
    } else {
      const d = Math.abs(min) * 0.1;
      min -= d;
      max += d;
    }
  }
  const raw = (max - min) / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step + 1e-9) * step,
    hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(dec));
  return { min: lo, max: hi, step, ticks };
}
/** Log axis ticks at powers of ten covering [min,max] (both > 0). */
export function logScale(min: number, max: number): { min: number; max: number; ticks: number[] } {
  const lo = Math.floor(Math.log10(Math.max(min, 1e-300))),
    hi = Math.ceil(Math.log10(Math.max(max, min * 10)));
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e++) ticks.push(10 ** e);
  return { min: 10 ** lo, max: 10 ** hi, ticks };
}
/** Compact number labels: 1200 -> 1.2K, 3_400_000 -> 3.4M; small numbers keep sensible decimals. */
export function fmtNum(v: number, compact = true): string {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (compact && a >= 1e9) return +(v / 1e9).toFixed(2) + 'B';
  if (compact && a >= 1e6) return +(v / 1e6).toFixed(2) + 'M';
  if (compact && a >= 1e4) return +(v / 1e3).toFixed(1) + 'K';
  if (a >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 1) return String(+v.toFixed(2));
  return String(+v.toPrecision(3));
}

/* ---- regressions (trendlines) ---- */
export interface Fit {
  predict: (x: number) => number;
  r2: number;
  equation: string;
  coeffs: number[];
}
const r2Of = (ys: number[], pred: number[]) => {
  const m = mean(ys);
  const st = sum(ys.map((y) => (y - m) ** 2));
  const se = sum(ys.map((y, i) => (y - pred[i]) ** 2));
  return st === 0 ? 1 : 1 - se / st;
};
const fmtC = (c: number) =>
  Math.abs(c) >= 1e4 || (Math.abs(c) < 1e-3 && c !== 0) ? c.toExponential(3) : String(+c.toPrecision(5));
export function linearFit(xs: number[], ys: number[]): Fit | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = mean(xs),
    my = mean(ys);
  const sxx = sum(xs.map((x) => (x - mx) ** 2));
  if (sxx === 0) return null;
  const b = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sxx,
    a = my - b * mx;
  return {
    predict: (x) => a + b * x,
    r2: r2Of(
      ys,
      xs.map((x) => a + b * x),
    ),
    equation: `y = ${fmtC(b)}x ${a < 0 ? '−' : '+'} ${fmtC(Math.abs(a))}`,
    coeffs: [a, b],
  };
}
export function expFit(xs: number[], ys: number[]): Fit | null {
  if (ys.some((y) => y <= 0)) return null;
  const lf = linearFit(xs, ys.map(Math.log));
  if (!lf) return null;
  const A = Math.exp(lf.coeffs[0]),
    B = lf.coeffs[1];
  return {
    predict: (x) => A * Math.exp(B * x),
    r2: r2Of(
      ys,
      xs.map((x) => A * Math.exp(B * x)),
    ),
    equation: `y = ${fmtC(A)}e^(${fmtC(B)}x)`,
    coeffs: [A, B],
  };
}
export function logFit(xs: number[], ys: number[]): Fit | null {
  if (xs.some((x) => x <= 0)) return null;
  const lf = linearFit(xs.map(Math.log), ys);
  if (!lf) return null;
  const [a, b] = lf.coeffs;
  return {
    predict: (x) => a + b * Math.log(x),
    r2: r2Of(
      ys,
      xs.map((x) => a + b * Math.log(x)),
    ),
    equation: `y = ${fmtC(b)}ln(x) ${a < 0 ? '−' : '+'} ${fmtC(Math.abs(a))}`,
    coeffs: [a, b],
  };
}
export function powerFit(xs: number[], ys: number[]): Fit | null {
  if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) return null;
  const lf = linearFit(xs.map(Math.log), ys.map(Math.log));
  if (!lf) return null;
  const A = Math.exp(lf.coeffs[0]),
    B = lf.coeffs[1];
  return {
    predict: (x) => A * x ** B,
    r2: r2Of(
      ys,
      xs.map((x) => A * x ** B),
    ),
    equation: `y = ${fmtC(A)}x^${fmtC(B)}`,
    coeffs: [A, B],
  };
}
/** Polynomial least squares of given degree via normal equations (Gaussian elimination, centered x for stability). */
export function polyFit(xs: number[], ys: number[], degree: number): Fit | null {
  const n = xs.length;
  if (n <= degree) return null;
  const m = degree + 1;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) A[i][j] = sum(xs.map((x) => x ** (i + j)));
    A[i][m] = sum(xs.map((x, k) => ys[k] * x ** i));
  }
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++)
      if (r !== c) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
      }
  }
  const co = A.map((row, i) => row[m] / row[i]);
  const pred = (x: number) => co.reduce((s, c, i) => s + c * x ** i, 0);
  const terms = co
    .map((c, i) => ({ c, i }))
    .reverse()
    .map(
      ({ c, i }, k) =>
        `${k === 0 ? (c < 0 ? '−' : '') : c < 0 ? ' − ' : ' + '}${fmtC(Math.abs(c))}${i === 0 ? '' : i === 1 ? 'x' : `x^${i}`}`,
    )
    .join('');
  return { predict: pred, r2: r2Of(ys, xs.map(pred)), equation: `y = ${terms}`, coeffs: co };
}
/** Trailing moving average (Excel style): value at i averages the previous `period` points; first period-1 are null. */
export function movingAverage(ys: number[], period: number): Array<number | null> {
  return ys.map((_, i) => (i < period - 1 ? null : mean(ys.slice(i - period + 1, i + 1))));
}

/* ---- histogram binning ---- */
/** Scott's normal reference rule (what Excel's histogram chart uses by default). */
export function scottBinWidth(values: number[]): number {
  const n = values.length;
  return n < 2 ? 1 : (3.5 * stdev(values)) / Math.cbrt(n);
}
export interface Bin {
  lo: number;
  hi: number;
  count: number;
}
/** Bins are (lo, hi] except the first which is [lo, hi]; this matches Excel's "overflow/underflow = off" behaviour. */
export function histogram(values: number[], opts: { bins?: number; width?: number } = {}): Bin[] {
  if (!values.length) return [];
  const min = minOf(values),
    max = maxOf(values);
  if (min === max) return [{ lo: min, hi: max, count: values.length }];
  let width = opts.width ?? (opts.bins ? (max - min) / opts.bins : scottBinWidth(values));
  if (!(width > 0)) width = (max - min) / 10;
  const n = Math.max(1, Math.ceil((max - min) / width - 1e-9));
  const bins: Bin[] = Array.from({ length: n }, (_, i) => ({
    lo: min + i * width,
    hi: Math.min(min + (i + 1) * width, i === n - 1 ? max : Infinity),
    count: 0,
  }));
  bins[n - 1].hi = Math.max(bins[n - 1].hi, max);
  for (const v of values) {
    let i = Math.ceil((v - min) / width - 1e-12) - 1;
    if (i < 0) i = 0;
    if (i >= n) i = n - 1;
    bins[i].count++;
  }
  return bins;
}

/* ---- treemap (squarified, Bruls et al.) ---- */
export interface TItem {
  label: string;
  value: number;
}
export interface TRect {
  label: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
export function squarify(items: TItem[], x: number, y: number, w: number, h: number): TRect[] {
  const list = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sum(list.map((i) => i.value));
  if (!list.length || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  const out: TRect[] = [];
  let rest = list.map((i) => ({ ...i, area: i.value * scale }));
  let rx = x,
    ry = y,
    rw = w,
    rh = h;
  const worst = (row: number[], side: number) => {
    const s = sum(row);
    return maxOf(row.map((a) => Math.max((side * side * a) / (s * s), (s * s) / (side * side * a))));
  };
  while (rest.length) {
    const side = Math.min(rw, rh);
    const row: typeof rest = [rest[0]];
    let i = 1;
    while (
      i < rest.length &&
      worst(
        [...row, rest[i]].map((r) => r.area),
        side,
      ) <=
        worst(
          row.map((r) => r.area),
          side,
        )
    ) {
      row.push(rest[i]);
      i++;
    }
    const s = sum(row.map((r) => r.area));
    if (rw >= rh) {
      const cw = s / rh;
      let cy = ry;
      for (const r of row) {
        const ch = r.area / cw;
        out.push({ label: r.label, value: r.value, x: rx, y: cy, w: cw, h: ch });
        cy += ch;
      }
      rx += cw;
      rw -= cw;
    } else {
      const ch = s / rw;
      let cx = rx;
      for (const r of row) {
        const cw = r.area / ch;
        out.push({ label: r.label, value: r.value, x: cx, y: ry, w: cw, h: ch });
        cx += cw;
      }
      ry += ch;
      rh -= ch;
    }
    rest = rest.slice(row.length);
  }
  return out;
}

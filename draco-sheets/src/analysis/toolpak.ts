// Analysis ToolPak (v1.0.0): pure statistics that return a grid of labelled results. No DOM, no engine.
export type G = Array<Array<string | number>>;
const sum = (a: number[]) => {
  let s = 0;
  for (const x of a) s += x;
  return s;
};
const mean = (a: number[]) => sum(a) / a.length;
const variance = (a: number[]) => {
  const m = mean(a);
  let s = 0;
  for (const x of a) s += (x - m) ** 2;
  return s / (a.length - 1);
};
const sd = (a: number[]) => Math.sqrt(variance(a));
const sorted = (a: number[]) => a.slice().sort((x, y) => x - y);
export const nums = (a: unknown[]) => a.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/* ---- distributions (regularised incomplete beta via continued fraction) ---- */
function lgamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let y = x,
    t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (const k of c) s += k / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}
function betacf(a: number, b: number, x: number): number {
  const FP = 1e-30;
  let c = 1,
    d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FP) d = FP;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FP) d = FP;
    c = 1 + aa / c;
    if (Math.abs(c) < FP) c = FP;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < FP) d = FP;
    c = 1 + aa / c;
    if (Math.abs(c) < FP) c = FP;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** Two-tailed p for Student t. */
export const tP2 = (t: number, df: number) => betai(df / 2, 0.5, df / (df + t * t));
/** Upper-tail p for F. */
export const fP = (f: number, d1: number, d2: number) => betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f));
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}
/** Inverse t (two-tailed alpha) by bisection. */
export function tCrit(alpha: number, df: number): number {
  let lo = 0,
    hi = 200;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    tP2(m, df) > alpha ? (lo = m) : (hi = m);
  }
  return (lo + hi) / 2;
}

const r6 = (n: number) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : n);
export function descriptive(cols: Array<{ name: string; values: number[] }>, confidence = 0.95): G {
  const rows = [
    'Mean',
    'Standard Error',
    'Median',
    'Mode',
    'Standard Deviation',
    'Sample Variance',
    'Kurtosis',
    'Skewness',
    'Range',
    'Minimum',
    'Maximum',
    'Sum',
    'Count',
    `Confidence Level(${confidence * 100}%)`,
  ];
  const out: G = [['', ...cols.map((c) => c.name)]];
  const cells = cols.map((c) => {
    const v = c.values,
      n = v.length,
      m = mean(v),
      s = sd(v),
      so = sorted(v);
    const med = n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2;
    const cnt = new Map<number, number>();
    v.forEach((x) => cnt.set(x, (cnt.get(x) ?? 0) + 1));
    let mode: number | string = '#N/A',
      best = 1;
    for (const [k, c2] of cnt)
      if (c2 > best) {
        best = c2;
        mode = k;
      }
    const sk = n > 2 ? (n / ((n - 1) * (n - 2))) * sum(v.map((x) => ((x - m) / s) ** 3)) : NaN;
    const ku =
      n > 3
        ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum(v.map((x) => ((x - m) / s) ** 4)) -
          (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
        : NaN;
    return [
      m,
      s / Math.sqrt(n),
      med,
      mode,
      s,
      variance(v),
      ku,
      sk,
      so[n - 1] - so[0],
      so[0],
      so[n - 1],
      sum(v),
      n,
      tCrit(1 - confidence, n - 1) * (s / Math.sqrt(n)),
    ];
  });
  rows.forEach((r, i) => out.push([r, ...cells.map((c) => (typeof c[i] === 'number' ? r6(c[i] as number) : c[i]))]));
  return out;
}
const pearson = (a: number[], b: number[]) => {
  const ma = mean(a),
    mb = mean(b);
  let sab = 0,
    saa = 0,
    sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};
export function correlation(cols: Array<{ name: string; values: number[] }>): G {
  const out: G = [['', ...cols.map((c) => c.name)]];
  cols.forEach((a, i) => out.push([a.name, ...cols.map((b, j) => (j > i ? '' : r6(pearson(a.values, b.values))))]));
  return out;
}
export function covariance(cols: Array<{ name: string; values: number[] }>): G {
  const out: G = [['', ...cols.map((c) => c.name)]];
  cols.forEach((a, i) =>
    out.push([
      a.name,
      ...cols.map((b, j) => {
        if (j > i) return '';
        const n = a.values.length,
          ma = mean(a.values),
          mb = mean(b.values);
        let s = 0;
        for (let k = 0; k < n; k++) s += (a.values[k] - ma) * (b.values[k] - mb);
        return r6(s / n);
      }),
    ]),
  );
  return out;
}

/** Gauss-Jordan solve of A x = b (square). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const f = M[r][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
  }
  return M.map((r) => r[n]);
}
function invert(A: number[][]): number[][] | null {
  const n = A.length;
  const cols: number[][] = [];
  for (let j = 0; j < n; j++) {
    const e = Array(n).fill(0);
    e[j] = 1;
    const x = solve(A, e);
    if (!x) return null;
    cols.push(x);
  }
  return A.map((_, i) => cols.map((c) => c[i]));
}
export interface RegResult {
  coef: number[];
  se: number[];
  t: number[];
  p: number[];
  r2: number;
  adjR2: number;
  stdErr: number;
  n: number;
  fStat: number;
  fSig: number;
  ssReg: number;
  ssRes: number;
  dfReg: number;
  dfRes: number;
}
export function regression(y: number[], xs: number[][]): RegResult | null {
  const n = y.length,
    k = xs.length;
  if (n <= k + 1) return null;
  const X = y.map((_, i) => [1, ...xs.map((x) => x[i])]);
  const p = k + 1;
  const XtX = Array.from({ length: p }, (_, a) =>
    Array.from({ length: p }, (_, b) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += X[i][a] * X[i][b];
      return s;
    }),
  );
  const Xty = Array.from({ length: p }, (_, a) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += X[i][a] * y[i];
    return s;
  });
  const inv = invert(XtX);
  if (!inv) return null;
  const beta = inv.map((r) => sum(r.map((v, j) => v * Xty[j])));
  const fit = X.map((r) => sum(r.map((v, j) => v * beta[j])));
  const ssRes = sum(y.map((v, i) => (v - fit[i]) ** 2));
  const my = mean(y);
  const ssTot = sum(y.map((v) => (v - my) ** 2));
  const ssReg = ssTot - ssRes;
  const dfRes = n - p,
    s2 = ssRes / dfRes;
  const se = inv.map((r, i) => Math.sqrt(s2 * r[i]));
  const t = beta.map((b, i) => b / se[i]);
  const pv = t.map((v) => tP2(v, dfRes));
  const r2 = ssTot ? 1 - ssRes / ssTot : 1;
  const f = ssReg / k / s2;
  return {
    coef: beta,
    se,
    t,
    p: pv,
    r2,
    adjR2: 1 - (1 - r2) * ((n - 1) / dfRes),
    stdErr: Math.sqrt(s2),
    n,
    fStat: f,
    fSig: fP(f, k, dfRes),
    ssReg,
    ssRes,
    dfReg: k,
    dfRes,
  };
}
export function regressionGrid(y: number[], xs: number[][], names: string[]): G {
  const r = regression(y, xs);
  if (!r) return [['Regression failed: not enough rows or the X columns are perfectly collinear.']];
  const out: G = [
    ['SUMMARY OUTPUT'],
    [''],
    ['Regression Statistics'],
    ['Multiple R', r6(Math.sqrt(Math.max(0, r.r2)))],
    ['R Square', r6(r.r2)],
    ['Adjusted R Square', r6(r.adjR2)],
    ['Standard Error', r6(r.stdErr)],
    ['Observations', r.n],
    [''],
    ['ANOVA'],
    ['', 'df', 'SS', 'MS', 'F', 'Significance F'],
    ['Regression', r.dfReg, r6(r.ssReg), r6(r.ssReg / r.dfReg), r6(r.fStat), r6(r.fSig)],
    ['Residual', r.dfRes, r6(r.ssRes), r6(r.ssRes / r.dfRes)],
    ['Total', r.n - 1, r6(r.ssReg + r.ssRes)],
    [''],
    ['', 'Coefficients', 'Standard Error', 't Stat', 'P-value', 'Lower 95%', 'Upper 95%'],
  ];
  const tc = tCrit(0.05, r.dfRes);
  ['Intercept', ...names].forEach((nm, i) =>
    out.push([
      nm,
      r6(r.coef[i]),
      r6(r.se[i]),
      r6(r.t[i]),
      r6(r.p[i]),
      r6(r.coef[i] - tc * r.se[i]),
      r6(r.coef[i] + tc * r.se[i]),
    ]),
  );
  return out;
}
export type TKind = 'paired' | 'equal' | 'unequal';
export function tTest(a: number[], b: number[], kind: TKind, alpha = 0.05): G {
  const ma = mean(a),
    mb = mean(b),
    va = variance(a),
    vb = variance(b);
  let t: number,
    df: number,
    extra: G = [];
  if (kind === 'paired') {
    if (a.length !== b.length) return [['Paired test needs two columns of the same length.']];
    const d = a.map((v, i) => v - b[i]);
    const md = mean(d),
      sdd = sd(d);
    df = d.length - 1;
    t = md / (sdd / Math.sqrt(d.length));
    const r = pearson(a, b);
    extra = [
      ['Pearson Correlation', r6(r)],
      ['Hypothesized Mean Difference', 0],
    ];
  } else if (kind === 'equal') {
    df = a.length + b.length - 2;
    const sp = ((a.length - 1) * va + (b.length - 1) * vb) / df;
    t = (ma - mb) / Math.sqrt(sp * (1 / a.length + 1 / b.length));
    extra = [
      ['Pooled Variance', r6(sp)],
      ['Hypothesized Mean Difference', 0],
    ];
  } else {
    const sa = va / a.length,
      sb = vb / b.length;
    t = (ma - mb) / Math.sqrt(sa + sb);
    df = (sa + sb) ** 2 / (sa ** 2 / (a.length - 1) + sb ** 2 / (b.length - 1));
    extra = [['Hypothesized Mean Difference', 0]];
  }
  const p2 = tP2(t, df),
    p1 = p2 / 2;
  const dfOut = kind === 'unequal' ? Math.round(df) : df;
  const name =
    kind === 'paired'
      ? 'Paired Two Sample for Means'
      : kind === 'equal'
        ? 'Two-Sample Assuming Equal Variances'
        : 'Two-Sample Assuming Unequal Variances';
  return [
    [`t-Test: ${name}`],
    ['', 'Variable 1', 'Variable 2'],
    ['Mean', r6(ma), r6(mb)],
    ['Variance', r6(va), r6(vb)],
    ['Observations', a.length, b.length],
    ...extra,
    ['df', r6(dfOut)],
    ['t Stat', r6(t)],
    ['P(T<=t) one-tail', r6(p1)],
    ['t Critical one-tail', r6(tCrit(alpha * 2, df))],
    ['P(T<=t) two-tail', r6(p2)],
    ['t Critical two-tail', r6(tCrit(alpha, df))],
  ];
}
export function fTest(a: number[], b: number[]): G {
  let va = variance(a),
    vb = variance(b),
    d1 = a.length - 1,
    d2 = b.length - 1;
  const f = va / vb;
  const p = f > 1 ? fP(f, d1, d2) : 1 - fP(f, d1, d2);
  return [
    ['F-Test Two-Sample for Variances'],
    ['', 'Variable 1', 'Variable 2'],
    ['Mean', r6(mean(a)), r6(mean(b))],
    ['Variance', r6(va), r6(vb)],
    ['Observations', a.length, b.length],
    ['df', d1, d2],
    ['F', r6(f)],
    ['P(F<=f) one-tail', r6(p)],
  ];
}
export function zTest(a: number[], b: number[], varA: number, varB: number): G {
  const z = (mean(a) - mean(b)) / Math.sqrt(varA / a.length + varB / b.length);
  const p1 = 1 - normCdf(Math.abs(z));
  return [
    ['z-Test: Two Sample for Means'],
    ['', 'Variable 1', 'Variable 2'],
    ['Mean', r6(mean(a)), r6(mean(b))],
    ['Known Variance', varA, varB],
    ['Observations', a.length, b.length],
    ['z', r6(z)],
    ['P(Z<=z) one-tail', r6(p1)],
    ['P(Z<=z) two-tail', r6(2 * p1)],
  ];
}
export function anova(groups: Array<{ name: string; values: number[] }>, alpha = 0.05): G {
  const all = groups.flatMap((g) => g.values),
    gm = mean(all),
    k = groups.length,
    N = all.length;
  const ssb = sum(groups.map((g) => g.values.length * (mean(g.values) - gm) ** 2));
  const ssw = sum(groups.map((g) => sum(g.values.map((v) => (v - mean(g.values)) ** 2))));
  const dfb = k - 1,
    dfw = N - k;
  const msb = ssb / dfb,
    msw = ssw / dfw,
    f = msb / msw,
    p = fP(f, dfb, dfw);
  const fcrit = (() => {
    let lo = 0,
      hi = 1000;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      fP(m, dfb, dfw) > alpha ? (lo = m) : (hi = m);
    }
    return (lo + hi) / 2;
  })();
  return [
    ['Anova: Single Factor'],
    [''],
    ['SUMMARY'],
    ['Groups', 'Count', 'Sum', 'Average', 'Variance'],
    ...groups.map((g) => [g.name, g.values.length, r6(sum(g.values)), r6(mean(g.values)), r6(variance(g.values))]),
    [''],
    ['ANOVA'],
    ['Source of Variation', 'SS', 'df', 'MS', 'F', 'P-value', 'F crit'],
    ['Between Groups', r6(ssb), dfb, r6(msb), r6(f), r6(p), r6(fcrit)],
    ['Within Groups', r6(ssw), dfw, r6(msw)],
    ['Total', r6(ssb + ssw), N - 1],
  ];
}
export function rankPercentile(v: number[]): G {
  const so = sorted(v).reverse();
  const n = v.length;
  return [
    ['Point', 'Value', 'Rank', 'Percent'],
    ...v.map((x, i) => [
      i + 1,
      x,
      so.indexOf(x) + 1,
      n > 1 ? `${r6(((n - 1 - so.indexOf(x)) / (n - 1)) * 100)}%` : '100%',
    ]),
  ];
}
export function movingAverage(v: number[], period: number): G {
  return [
    ['Value', `Moving Avg (${period})`],
    ...v.map((x, i) => [x, i + 1 < period ? '#N/A' : r6(mean(v.slice(i + 1 - period, i + 1)))]),
  ];
}
export function expSmoothing(v: number[], damping: number): G {
  const a = 1 - damping;
  const out: G = [['Value', 'Forecast']];
  let f: number | string = '#N/A';
  v.forEach((x, i) => {
    out.push([x, f]);
    f = i === 0 ? x : a * x + (1 - a) * (f as number);
    f = typeof f === 'number' ? r6(f) : f;
  });
  return out;
}
export function histogramBins(v: number[], bins: number[]): G {
  const b = sorted(bins);
  const cnt = Array(b.length + 1).fill(0);
  for (const x of v) {
    let i = 0;
    while (i < b.length && x > b[i]) i++;
    cnt[i]++;
  }
  return [['Bin', 'Frequency'], ...b.map((x, i) => [x, cnt[i]]), ['More', cnt[b.length]]];
}
export function sample(v: number[], n: number, seed = 1, periodic = false): G {
  if (periodic) return [['Sample'], ...v.filter((_, i) => (i + 1) % n === 0).map((x) => [x])];
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = v.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return [['Sample'], ...idx.slice(0, Math.min(n, v.length)).map((i) => [v[i]])];
}

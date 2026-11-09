import {
  boxStats,
  clean,
  fmtNum,
  histogram,
  isNum,
  linearFit,
  expFit,
  logFit,
  powerFit,
  polyFit,
  movingAverage,
  niceScale,
  logScale,
  stdev,
  sum,
  type Fit,
} from '../math';
import { maxOf, minOf } from '../../formulas/safeMath';
import { type ChartOpts, type Series } from './types';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** Axis-based charts: column / bar / line / area / scatter / bubble / histogram / box / waterfall / stock / combo. */
export function renderAxis(c: RenderCtx): string {
  const {
    o,
    col,
    fg,
    mute,
    gridc,
    bg,
    font,
    out,
    t,
    cats,
    ser,
    W,
    H,
    L,
    T,
    B,
    pw,
    ph,
    legendPos,
    showLegend,
    secondary,
    legW,
  } = c;

  /* ===== axis-based charts ===== */
  const horizontal = t === 'bar';
  type Pt = { cat: number; x?: number; y: number; y0: number };
  let xcat = cats.slice();
  // histogram / box transform data into bar/box primitives
  let vs = ser;
  if (t === 'histogram') {
    const bins = histogram(clean(ser[0].values), { bins: o.bins, width: o.binWidth });
    xcat = bins.map((b, i) => `${i === 0 ? '[' : '('}${fmtNum(b.lo, false)}, ${fmtNum(b.hi, false)}]`);
    vs = [{ name: 'Count', values: bins.map((b) => b.count) }];
  }
  if (t === 'box') {
    const stats = ser.map((s) => boxStats(clean(s.values)));
    const all = clean(stats.flatMap((s) => (s ? [s.min, s.max, ...s.outliers] : [])));
    const sc = niceScale(minOf(all), maxOf(all));
    const yy = (v: number) => T + ph - ((v - sc.min) / (sc.max - sc.min)) * ph;
    const slot = pw / ser.length;
    for (const tk of sc.ticks)
      out.push(
        `<line x1="${L}" x2="${L + pw}" y1="${f1(yy(tk))}" y2="${f1(yy(tk))}" stroke="${gridc}"/><text x="${L - 6}" y="${f1(yy(tk) + 4)}" text-anchor="end" fill="${mute}">${fmtNum(tk)}</text>`,
      );
    stats.forEach((s, i) => {
      if (!s) return;
      const cx = L + slot * (i + 0.5),
        bw = Math.min(60, slot * 0.5),
        c = col(i, ser[i]);
      out.push(
        `<g><title>${esc(ser[i].name)}: min ${fmtNum(s.min)}, Q1 ${fmtNum(s.q1)}, median ${fmtNum(s.median)}, Q3 ${fmtNum(s.q3)}, max ${fmtNum(s.max)}</title><line x1="${f1(cx)}" x2="${f1(cx)}" y1="${f1(yy(s.min))}" y2="${f1(yy(s.max))}" stroke="${fg}"/><line x1="${f1(cx - bw / 4)}" x2="${f1(cx + bw / 4)}" y1="${f1(yy(s.min))}" y2="${f1(yy(s.min))}" stroke="${fg}"/><line x1="${f1(cx - bw / 4)}" x2="${f1(cx + bw / 4)}" y1="${f1(yy(s.max))}" y2="${f1(yy(s.max))}" stroke="${fg}"/><rect x="${f1(cx - bw / 2)}" y="${f1(yy(s.q3))}" width="${f1(bw)}" height="${f1(Math.max(1, yy(s.q1) - yy(s.q3)))}" fill="${c}" fill-opacity=".55" stroke="${c}"/><line x1="${f1(cx - bw / 2)}" x2="${f1(cx + bw / 2)}" y1="${f1(yy(s.median))}" y2="${f1(yy(s.median))}" stroke="${fg}" stroke-width="2"/><text x="${f1(cx)}" y="${f1(cy0(T, ph) + 16)}" text-anchor="middle" fill="${mute}">${esc(trunc(ser[i].name, 12))}</text>`,
      );
      out.push(
        `<text x="${f1(cx)}" y="${f1(yy(s.mean) + 4)}" text-anchor="middle" fill="${fg}" font-size="10">×</text>`,
      );
      for (const ov of s.outliers)
        out.push(`<circle cx="${f1(cx)}" cy="${f1(yy(ov))}" r="3" fill="none" stroke="${c}"/>`);
      out.push('</g>');
    });
    out.push('</svg>');
    return out.join('');
  }
  function cy0(t0: number, p: number) {
    return t0 + p;
  }

  // y domain
  const prim = vs.filter((s) => !s.secondary),
    sec = vs.filter((s) => s.secondary);
  const stack = o.stack ?? 'none';
  const stackable = t === 'column' || t === 'bar' || t === 'area' || t === 'histogram';
  const nCat = maxOf(
    vs.map((s) => s.values.length),
    [xcat.length],
  );
  function domain(list: Series[], isStack: boolean) {
    if (t === 'waterfall') {
      let run = 0,
        lo = 0,
        hi = 0;
      for (const v of list[0].values) {
        run += (v as number) ?? 0;
        lo = Math.min(lo, run);
        hi = Math.max(hi, run);
      }
      return [lo, hi];
    }
    if (t === 'stock')
      return [minOf(clean(list.flatMap((s) => s.values))), maxOf(clean(list.flatMap((s) => s.values)))];
    let lo = Infinity,
      hi = -Infinity;
    if (isStack && stackable) {
      for (let i = 0; i < nCat; i++) {
        let pos = 0,
          neg = 0;
        for (const s of list) {
          const v = (s.values[i] as number) ?? 0;
          v >= 0 ? (pos += v) : (neg += v);
        }
        hi = Math.max(hi, pos);
        lo = Math.min(lo, neg);
      }
      lo = Math.min(lo, 0);
    } else
      for (const s of list)
        for (const v of s.values)
          if (isNum(v)) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
    if (o.err && !isStack) {
      for (const s of list) {
        const e = errAmt(s, o.err);
        for (const v of s.values)
          if (isNum(v)) {
            const d = e(v);
            lo = Math.min(lo, v - d);
            hi = Math.max(hi, v + d);
          }
      }
    }
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    if (t === 'bubble') {
      const pd = (hi - lo || 1) * 0.15;
      lo -= pd;
      hi += pd;
    }
    if (t !== 'scatter' && t !== 'bubble' && t !== 'line') {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    return [lo, hi];
  }
  const isPct = stack === 'percent' && stackable;
  let [pLo, pHi] = isPct ? [0, 100] : domain(prim.length ? prim : vs, stack !== 'none');
  const [sLo, sHi] = sec.length ? domain(sec, false) : [0, 1];
  const scaleOf = (lo: number, hi: number, log: boolean) => {
    if (log && lo > 0) {
      const s = logScale(Math.max(lo, 1e-9), hi);
      return { min: s.min, max: s.max, ticks: s.ticks, log: true };
    }
    const s = niceScale(lo, hi, Math.max(3, Math.floor((horizontal ? pw : ph) / 45)));
    return { min: s.min, max: s.max, ticks: s.ticks, log: false };
  };
  if (o.yMin != null) pLo = o.yMin;
  if (o.yMax != null) pHi = o.yMax;
  const ys = scaleOf(pLo, pHi, !!o.logY),
    ys2 = scaleOf(sLo, sHi, false);
  const frac = (sc: { min: number; max: number; log: boolean }, v: number) =>
    sc.log
      ? (Math.log10(Math.max(v, sc.min)) - Math.log10(sc.min)) / (Math.log10(sc.max) - Math.log10(sc.min))
      : (v - sc.min) / (sc.max - sc.min);
  const Y = (v: number, sc = ys) => (horizontal ? L + frac(sc, v) * pw : T + ph - frac(sc, v) * ph);
  const isXY = t === 'scatter' || t === 'bubble';
  let xs: ReturnType<typeof scaleOf> | null = null;
  if (isXY) {
    const xv = clean(vs.flatMap((s) => s.xs ?? s.values.map((_, i) => i + 1)));
    const xl = minOf(xv),
      xh = maxOf(xv),
      xp = (xh - xl || 1) * (t === 'bubble' ? 0.12 : 0.04);
    xs = scaleOf(xl - xp, xh + xp, false);
  }
  const slot = (horizontal ? ph : pw) / Math.max(1, nCat);
  const catPos = (i: number) => (horizontal ? T + slot * (i + 0.5) : L + slot * (i + 0.5));
  const X = (i: number) => catPos(i);

  // grid + axes
  const gridOn = o.grid !== false;
  for (const tk of ys.ticks) {
    const p = Y(tk);
    const lab = isPct ? tk + '%' : fmtNum(tk);
    if (horizontal)
      out.push(
        `${gridOn ? `<line x1="${f1(p)}" x2="${f1(p)}" y1="${T}" y2="${T + ph}" stroke="${gridc}"/>` : ''}<text x="${f1(p)}" y="${T + ph + 14}" text-anchor="middle" fill="${mute}">${lab}</text>`,
      );
    else
      out.push(
        `${gridOn ? `<line x1="${L}" x2="${L + pw}" y1="${f1(p)}" y2="${f1(p)}" stroke="${gridc}"/>` : ''}<text x="${L - 6}" y="${f1(p + 4)}" text-anchor="end" fill="${mute}">${lab}</text>`,
      );
  }
  if (secondary)
    for (const tk of ys2.ticks)
      out.push(`<text x="${L + pw + 6}" y="${f1(Y(tk, ys2) + 4)}" fill="${mute}">${fmtNum(tk)}</text>`);
  out.push(
    `<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="${mute}"/><line x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}" stroke="${mute}"/>`,
  );
  if (isXY && xs) {
    for (const tk of xs.ticks) {
      const px = L + frac(xs, tk) * pw;
      out.push(
        `${gridOn ? `<line x1="${f1(px)}" x2="${f1(px)}" y1="${T}" y2="${T + ph}" stroke="${gridc}"/>` : ''}<text x="${f1(px)}" y="${T + ph + 14}" text-anchor="middle" fill="${mute}">${fmtNum(tk)}</text>`,
      );
    }
  } else {
    const every = Math.max(1, Math.ceil((horizontal ? 14 : 44) / slot));
    xcat.forEach((c, i) => {
      if (i % every) return;
      out.push(
        horizontal
          ? `<text x="${L - 6}" y="${f1(catPos(i) + 4)}" text-anchor="end" fill="${mute}">${esc(trunc(c, 8))}</text>`
          : `<text x="${f1(catPos(i))}" y="${T + ph + 14}" text-anchor="middle" fill="${mute}">${esc(trunc(c, Math.max(3, Math.floor((slot * every) / 6.5))))}</text>`,
      );
    });
  }
  if (o.xTitle)
    out.push(
      `<text x="${L + pw / 2}" y="${H - B + (showLegend && legendPos === 'bottom' ? 0 : 20) + 14 - (showLegend && legendPos === 'bottom' ? 0 : 0)}" text-anchor="middle" fill="${fg}" font-weight="600">${esc(o.xTitle)}</text>`,
    );
  if (o.yTitle)
    out.push(
      `<text transform="translate(12 ${T + ph / 2}) rotate(-90)" text-anchor="middle" fill="${fg}" font-weight="600">${esc(o.yTitle)}</text>`,
    );
  if (o.y2Title && secondary)
    out.push(
      `<text transform="translate(${W - (showLegend && legendPos === 'right' ? legW : 0) - 8} ${T + ph / 2}) rotate(90)" text-anchor="middle" fill="${fg}" font-weight="600">${esc(o.y2Title)}</text>`,
    );

  const lbl = (x: number, y: number, v: number, anchor = 'middle') =>
    o.labels
      ? `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" fill="${fg}" font-size="10">${isPct ? '' : ''}${fmtNum(v)}</text>`
      : '';
  function errAmt(s: Series, e: NonNullable<ChartOpts['err']>) {
    const sd = stdev(clean(s.values));
    return (v: number) =>
      e.kind === 'fixed'
        ? (e.value ?? 1)
        : e.kind === 'pct'
          ? Math.abs(v) * ((e.value ?? 5) / 100)
          : sd * (e.value ?? 1);
  }
  const barKinds = vs
    .map((s, i) => ({ s, i }))
    .filter(({ s }) =>
      t === 'combo' ? (s.kind ?? 'column') === 'column' : t === 'column' || t === 'bar' || t === 'histogram',
    );

  // waterfall
  if (t === 'waterfall') {
    let run = 0;
    const s = vs[0];
    const bw = slot * 0.62;
    s.values.forEach((raw, i) => {
      const v = (raw as number) ?? 0;
      const isTotal = /^total$/i.test(xcat[i] ?? '');
      const start = isTotal ? 0 : run;
      const end = isTotal ? run : run + v;
      if (!isTotal) run = end;
      const y0 = Y(Math.min(start, end)),
        y1 = Y(Math.max(start, end));
      const c = isTotal ? '#4472C4' : v >= 0 ? '#70AD47' : '#E4572E';
      out.push(
        `<rect x="${f1(X(i) - bw / 2)}" y="${f1(y1)}" width="${f1(bw)}" height="${f1(Math.max(1, y0 - y1))}" fill="${c}"><title>${esc(xcat[i])}: ${v >= 0 ? '+' : ''}${fmtNum(isTotal ? run : v)}</title></rect>`,
      );
      if (i < s.values.length - 1)
        out.push(
          `<line x1="${f1(X(i) + bw / 2)}" x2="${f1(X(i + 1) - bw / 2)}" y1="${f1(Y(end))}" y2="${f1(Y(end))}" stroke="${mute}" stroke-dasharray="2 2"/>`,
        );
      out.push(lbl(X(i), y1 - 4, isTotal ? run : v));
    });
  }
  // stock (OHLC or HLC: series = open, high, low, close)
  else if (t === 'stock') {
    const get = (k: number, i: number) => vs[k]?.values[i] as number | null;
    const hasO = vs.length >= 4;
    const [hi, lo, cl, op] = hasO ? [1, 2, 3, 0] : [0, 1, 2, -1];
    for (let i = 0; i < nCat; i++) {
      const h = get(hi, i),
        l = get(lo, i),
        c = get(cl, i),
        op_ = op >= 0 ? get(op, i) : null;
      if (![h, l, c].every(isNum)) continue;
      const up = op_ == null || c! >= op_!;
      const cc = up ? '#2D936C' : '#D1495B';
      const bw = Math.min(14, slot * 0.5);
      out.push(
        `<g stroke="${cc}"><title>${esc(xcat[i])} H ${h} L ${l} C ${c}${op_ != null ? ' O ' + op_ : ''}</title><line x1="${f1(X(i))}" x2="${f1(X(i))}" y1="${f1(Y(h!))}" y2="${f1(Y(l!))}"/>${op_ != null ? `<rect x="${f1(X(i) - bw / 2)}" y="${f1(Y(Math.max(op_, c!)))}" width="${f1(bw)}" height="${f1(Math.max(1, Math.abs(Y(op_) - Y(c!))))}" fill="${cc}"/>` : `<line x1="${f1(X(i))}" x2="${f1(X(i) + 5)}" y1="${f1(Y(c!))}" y2="${f1(Y(c!))}"/>`}</g>`,
      );
    }
  } else {
    // bars (column / bar / histogram / combo-column), supports stacking
    const nb = barKinds.length;
    const gap = t === 'histogram' ? 0.02 : 0.2;
    const stackedBars = stack !== 'none' && stackable;
    const grp = slot * (1 - gap * 2);
    const bw = stackedBars ? grp : grp / Math.max(1, nb);
    const base = new Map<number, [number, number]>();
    barKinds.forEach(({ s, i: si }, k) => {
      const useSec = !!s.secondary;
      const sc = useSec ? ys2 : ys;
      s.values.forEach((raw, i) => {
        if (!isNum(raw)) return;
        let v = raw as number;
        let from = 0;
        if (stackedBars) {
          const tot = isPct ? sum(barKinds.map(({ s: q }) => Math.abs((q.values[i] as number) ?? 0))) || 1 : 1;
          if (isPct) v = (v / tot) * 100;
          const [pos, neg] = base.get(i) ?? [0, 0];
          if (v >= 0) {
            from = pos;
            base.set(i, [pos + v, neg]);
          } else {
            from = neg;
            base.set(i, [pos, neg + v]);
          }
        }
        const a = horizontal ? Y(from, sc) : Y(from, sc),
          b = horizontal ? Y(from + v, sc) : Y(from + v, sc);
        const off = stackedBars ? 0 : k * bw;
        const c = col(si, s);
        const tip = `${s.name} · ${xcat[i]}: ${fmtNum(raw as number, false)}`;
        if (horizontal)
          out.push(
            `<rect x="${f1(Math.min(a, b))}" y="${f1(slot * i + T + slot * gap + off)}" width="${f1(Math.abs(b - a))}" height="${f1(bw - 1)}" fill="${c}"><title>${esc(tip)}</title></rect>${lbl(Math.max(a, b) + 3, slot * i + T + slot * gap + off + bw / 2 + 3, raw as number, 'start')}`,
          );
        else
          out.push(
            `<rect x="${f1(L + slot * i + slot * gap + off)}" y="${f1(Math.min(a, b))}" width="${f1(Math.max(1, bw - 1))}" height="${f1(Math.max(0.5, Math.abs(b - a)))}" fill="${c}"><title>${esc(tip)}</title></rect>${lbl(L + slot * i + slot * gap + off + bw / 2, Math.min(a, b) - 3, raw as number)}`,
          );
        if (o.err && !stackedBars) {
          const d = errAmt(s, o.err)(raw as number);
          const cx = L + slot * i + slot * gap + off + bw / 2;
          out.push(
            `<g stroke="${fg}"><line x1="${f1(cx)}" x2="${f1(cx)}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v - d, sc))}"/><line x1="${f1(cx - 3)}" x2="${f1(cx + 3)}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v + d, sc))}"/><line x1="${f1(cx - 3)}" x2="${f1(cx + 3)}" y1="${f1(Y(v - d, sc))}" y2="${f1(Y(v - d, sc))}"/></g>`,
          );
        }
      });
    });
    // lines & areas (line / area / combo)
    const lineKinds = vs
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => (t === 'combo' ? s.kind === 'line' || s.kind === 'area' : t === 'line' || t === 'area'));
    const areaBase = new Map<number, number>();
    lineKinds.forEach(({ s, i: si }) => {
      const sc = s.secondary ? ys2 : ys;
      const c = col(si, s);
      const isArea = t === 'area' || s.kind === 'area';
      const stackedArea = isArea && stack !== 'none';
      const pts: Array<[number, number, number]> = [];
      s.values.forEach((raw, i) => {
        if (!isNum(raw)) return;
        let v = raw as number;
        let from = 0;
        if (stackedArea) {
          const tot = isPct ? sum(lineKinds.map(({ s: q }) => Math.abs((q.values[i] as number) ?? 0))) || 1 : 1;
          if (isPct) v = (v / tot) * 100;
          from = areaBase.get(i) ?? 0;
          areaBase.set(i, from + v);
          v = from + v;
        }
        pts.push([X(i), Y(v, sc), Y(from, sc)]);
      });
      if (!pts.length) return;
      const path = (arr: Array<[number, number]>) => {
        if (!o.smooth || arr.length < 3) return 'M' + arr.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L');
        let d = `M${f1(arr[0][0])} ${f1(arr[0][1])}`;
        for (let i = 0; i < arr.length - 1; i++) {
          const p0 = arr[i - 1] ?? arr[i],
            p1 = arr[i],
            p2 = arr[i + 1],
            p3 = arr[i + 2] ?? p2;
          d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
        }
        return d;
      };
      if (isArea)
        out.push(
          `<path d="${path(pts.map((p) => [p[0], p[1]]))}L${f1(pts[pts.length - 1][0])} ${f1(pts[pts.length - 1][2])}L${f1(pts[0][0])} ${f1(pts[0][2])}Z" fill="${c}" fill-opacity="${stackedArea ? 0.85 : 0.35}" stroke="${c}" stroke-width="1.5"/>`.replace(
            /(C[^L]*)L(\d)/,
            '$1L$2',
          ),
        );
      else {
        out.push(
          `<path d="${path(pts.map((p) => [p[0], p[1]]))}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`,
        );
        if (o.markers !== false)
          pts.forEach((p, k) =>
            out.push(
              `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="3.2" fill="${bg}" stroke="${c}" stroke-width="1.8"><title>${esc(s.name)} · ${esc(xcat[k] ?? '')}</title></circle>`,
            ),
          );
      }
      if (o.labels)
        s.values.forEach((v, i) => {
          if (isNum(v)) out.push(lbl(X(i), Y(v, sc) - 6, v));
        });
      if (o.err) {
        const e = errAmt(s, o.err);
        s.values.forEach((v, i) => {
          if (!isNum(v)) return;
          const d = e(v);
          out.push(
            `<g stroke="${fg}"><line x1="${f1(X(i))}" x2="${f1(X(i))}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v - d, sc))}"/><line x1="${f1(X(i) - 3)}" x2="${f1(X(i) + 3)}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v + d, sc))}"/><line x1="${f1(X(i) - 3)}" x2="${f1(X(i) + 3)}" y1="${f1(Y(v - d, sc))}" y2="${f1(Y(v - d, sc))}"/></g>`,
          );
        });
      }
    });
    // scatter / bubble
    if (isXY && xs) {
      const maxS = maxOf(clean(vs.flatMap((s) => s.sizes ?? [])), [1]);
      vs.forEach((s, si) => {
        const c = col(si, s);
        s.values.forEach((v, i) => {
          if (!isNum(v)) return;
          const x = s.xs?.[i] ?? i + 1;
          const r = t === 'bubble' ? 4 + Math.sqrt((s.sizes?.[i] ?? 1) / maxS) * 22 : 4;
          out.push(
            `<circle cx="${f1(L + frac(xs!, x) * pw)}" cy="${f1(Y(v))}" r="${f1(r)}" fill="${c}" fill-opacity="${t === 'bubble' ? 0.55 : 0.85}" stroke="${c}"><title>${esc(s.name)}: (${fmtNum(x, false)}, ${fmtNum(v, false)})${t === 'bubble' ? ' size ' + fmtNum(s.sizes?.[i] ?? 0) : ''}</title></circle>`,
          );
          if (o.labels) out.push(lbl(L + frac(xs!, x) * pw, Y(v) - r - 3, v));
        });
      });
    }
    // trendline(s)
    if (o.trend) {
      vs.forEach((s, si) => {
        const pts = s.values
          .map((v, i) => [isXY ? (s.xs?.[i] ?? i + 1) : i + 1, v] as const)
          .filter((p): p is [number, number] => isNum(p[1]));
        const xsA = pts.map((p) => p[0]),
          ysA = pts.map((p) => p[1]);
        const c = col(si, s);
        const tr = o.trend!;
        const toPx = (x: number, y: number) => [isXY && xs ? L + frac(xs, x) * pw : X(x - 1), Y(y)] as const;
        if (tr.type === 'ma') {
          const ma = movingAverage(
            s.values.map((v) => (isNum(v) ? v : 0)),
            tr.period ?? 2,
          );
          const d = ma.map((v, i) => (v == null ? null : toPx(i + 1, v))).filter(Boolean) as Array<
            readonly [number, number]
          >;
          if (d.length > 1)
            out.push(
              `<path d="M${d.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}" fill="none" stroke="${c}" stroke-dasharray="5 4" stroke-width="1.8"><title>Moving average (${tr.period ?? 2})</title></path>`,
            );
          return;
        }
        let fit: Fit | null = null;
        if (tr.type === 'linear') fit = linearFit(xsA, ysA);
        else if (tr.type === 'exp') fit = expFit(xsA, ysA);
        else if (tr.type === 'log') fit = logFit(xsA, ysA);
        else if (tr.type === 'power') fit = powerFit(xsA, ysA);
        else if (tr.type === 'poly') fit = polyFit(xsA, ysA, tr.degree ?? 2);
        if (!fit) return;
        const x0 = minOf(xsA),
          x1 = maxOf(xsA) + (tr.forward ?? 0);
        const N = 40;
        const line: string[] = [];
        for (let k = 0; k <= N; k++) {
          const x = x0 + ((x1 - x0) * k) / N;
          const y = fit.predict(x);
          if (!Number.isFinite(y)) continue;
          const [px, py] = toPx(x, Math.min(Math.max(y, ys.min), ys.max));
          line.push(`${f1(px)} ${f1(py)}`);
        }
        out.push(
          `<path d="M${line.join('L')}" fill="none" stroke="${c}" stroke-dasharray="6 4" stroke-width="1.8"><title>${esc(tr.type)} trend · R² ${f1(fit.r2)}</title></path>`,
        );
        if (tr.showEq || tr.showR2)
          out.push(
            `<text x="${L + pw - 4}" y="${T + 14 + si * 14}" text-anchor="end" fill="${c}" font-size="10">${tr.showEq ? esc(fit.equation) : ''}${tr.showEq && tr.showR2 ? '  ' : ''}${tr.showR2 ? 'R² = ' + f1(fit.r2) : ''}</text>`,
          );
      });
    }
  }
  out.push('</svg>');
  return out.join('');
}

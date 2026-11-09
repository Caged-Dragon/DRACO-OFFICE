// Pure SVG chart renderer (v61-v68). No DOM needed -> unit-testable in Node.
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
  squarify,
  stdev,
  sum,
  type Fit,
} from '../math';
import { maxOf, minOf } from '../../formulas/safeMath';
import { TABLE, resolveRegion, type MapKind } from '../maps';

import { PALETTES, type ChartOpts, type ChartSpec, type Series } from './types';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';
import { renderPie } from './pie';
import { renderTreemap } from './treemap';
import { renderSurface } from './surface';
import { renderSurface3d } from './surface3d';
import { renderMap } from './map';
import { renderFunnel } from './funnel';
import { renderRadar } from './radar';
import { renderAxis } from './axis';

export function renderChart(spec: ChartSpec, W = 480, H = 300): string {
  const o = spec.opts ?? {};
  const dark = o.theme === 'dark';
  const pal = PALETTES[o.palette ?? 'office'] ?? PALETTES.office;
  const col = (i: number, s?: Series) => s?.color ?? pal[i % pal.length];
  const fg = dark ? '#e6e6e6' : '#333',
    mute = dark ? '#8a8a8a' : '#777',
    gridc = dark ? '#3a3a3a' : '#e3e3e3',
    bg = o.bg ?? (dark ? '#1e1e1e' : '#ffffff');
  const font = o.font ?? 'Segoe UI, Roboto, Arial, sans-serif';
  const out: string[] = [];
  const t = spec.type;
  const cats = spec.categories;
  const ser = spec.series;
  const legendPos = o.legend ?? 'bottom';
  const pieLike = t === 'pie' || t === 'doughnut' || t === 'treemap' || t === 'sunburst' || t === 'funnel';
  const showLegend =
    legendPos !== 'none' &&
    t !== 'surface' &&
    t !== 'surface3d' &&
    t !== 'map' &&
    (pieLike ? t !== 'treemap' && t !== 'funnel' : ser.length > 1 || t === 'waterfall');
  const titleH = spec.title ? 30 : 8;
  let L = 8,
    R = 8,
    T = titleH,
    B = 8;
  const legendItems: Array<{ name: string; color: string }> = pieLike
    ? cats.map((c, i) => ({ name: c, color: pal[i % pal.length] }))
    : t === 'waterfall'
      ? [
          { name: 'Increase', color: '#70AD47' },
          { name: 'Decrease', color: '#E4572E' },
          { name: 'Total', color: '#4472C4' },
        ]
      : ser.map((s, i) => ({ name: s.name, color: col(i, s) }));
  const legW = Math.min(
    150,
    maxOf(
      legendItems.map((l) => l.name.length),
      [4],
    ) *
      6.5 +
      26,
  );
  if (showLegend) {
    if (legendPos === 'bottom') B += 22;
    else if (legendPos === 'top') T += 22;
    else if (legendPos === 'left') L += legW;
    else R += legW;
  }
  const tName: string = t;
  const hasAxes = !pieLike && tName !== 'radar' && tName !== 'surface' && tName !== 'surface3d' && tName !== 'map';
  const secondary = ser.some((s) => s.secondary);
  if (hasAxes) {
    L += 44 + (o.yTitle ? 16 : 0);
    B += 26 + (o.xTitle ? 16 : 0);
    R += secondary ? 44 + (o.y2Title ? 16 : 0) : 6;
    T += 6;
  }
  const pw = W - L - R,
    ph = H - T - B;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(font)}" font-size="11" role="img" aria-label="${esc(spec.title ?? t + ' chart')}"><rect width="${W}" height="${H}" fill="${bg}"/>`,
  );
  if (spec.title)
    out.push(
      `<text x="${W / 2}" y="20" text-anchor="middle" font-size="14" font-weight="600" fill="${fg}">${esc(spec.title)}</text>`,
    );
  if (showLegend) {
    const fit = legendPos === 'left' || legendPos === 'right';
    let lx = legendPos === 'left' ? 8 : legendPos === 'right' ? W - legW - 4 : 0,
      ly = legendPos === 'top' ? titleH + 4 : legendPos === 'bottom' ? H - 18 : T + 8;
    if (!fit) {
      const tot = legendItems.reduce((a, l) => a + l.name.length * 6.2 + 24, 0);
      lx = Math.max(8, (W - tot) / 2);
    }
    for (const l of legendItems.slice(0, 24)) {
      out.push(
        `<rect x="${f1(lx)}" y="${f1(ly)}" width="10" height="10" rx="2" fill="${l.color}"/><text x="${f1(lx + 14)}" y="${f1(ly + 9)}" fill="${fg}">${esc(trunc(l.name, 22))}</text>`,
      );
      if (fit) ly += 16;
      else lx += l.name.length * 6.2 + 24;
    }
  }
  const empty = () => {
    out.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${mute}">No data</text></svg>`);
    return out.join('');
  };
  if (!ser.length || (!cats.length && !['scatter', 'bubble', 'histogram', 'box'].includes(t))) return empty();
  const ctx: RenderCtx = {
    spec,
    o,
    dark,
    pal,
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
    R,
    T,
    B,
    pw,
    ph,
    empty,
    legendPos,
    showLegend,
    secondary,
    hasAxes,
    tName,
    pieLike,
    legendItems,
    legW,
    titleH,
  };

  /* ----- pie / doughnut / sunburst ----- */
  if (t === 'pie' || t === 'doughnut' || t === 'sunburst') return renderPie(ctx);

  /* ----- treemap ----- */
  if (t === 'treemap') return renderTreemap(ctx);

  /* ----- surface (top view: value bands as a heat grid) ----- */
  if (t === 'surface') return renderSurface(ctx);

  /* ----- 3-D surface (v64): isometric mesh, painter's algorithm ----- */
  if (t === 'surface3d') return renderSurface3d(ctx);

  /* ----- map (v72): tile maps for US / India, bubble map for world ----- */
  if (t === 'map') return renderMap(ctx);

  /* ----- funnel ----- */
  if (t === 'funnel') return renderFunnel(ctx);

  /* ----- radar ----- */
  if (t === 'radar') return renderRadar(ctx);
  return renderAxis(ctx);
}

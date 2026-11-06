// Pure SVG chart renderer (v61-v68). No DOM needed -> unit-testable in Node.
import { boxStats, clean, fmtNum, histogram, isNum, linearFit, expFit, logFit, powerFit, polyFit, movingAverage, niceScale, logScale, squarify, stdev, sum, type Fit } from './math';
import { maxOf, minOf } from '../safeMath';
import { TABLE, resolveRegion, type MapKind } from './maps';

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'bubble' | 'radar' | 'stock' | 'combo' | 'waterfall' | 'funnel' | 'histogram' | 'box' | 'treemap' | 'sunburst' | 'surface' | 'surface3d' | 'map';
export interface Series { name: string; values: Array<number | null>; xs?: number[]; sizes?: number[]; kind?: 'column' | 'line' | 'area'; secondary?: boolean; color?: string }
export interface Trend { type: 'linear' | 'exp' | 'log' | 'power' | 'poly' | 'ma'; degree?: number; period?: number; forward?: number; showEq?: boolean; showR2?: boolean }
export interface ChartOpts {
  legend?: 'top' | 'bottom' | 'left' | 'right' | 'none'; labels?: boolean; grid?: boolean; xTitle?: string; yTitle?: string; y2Title?: string;
  stack?: 'none' | 'stacked' | 'percent'; trend?: Trend; err?: { kind: 'fixed' | 'pct' | 'stdev'; value?: number }; palette?: string; logY?: boolean;
  smooth?: boolean; markers?: boolean; hole?: number; bins?: number; binWidth?: number; theme?: 'light' | 'dark'; font?: string; yMin?: number; yMax?: number; bg?: string; map?: MapKind; azimuth?: number; elevation?: number;
}
export interface ChartSpec { type: ChartType; title?: string; categories: string[]; series: Series[]; opts?: ChartOpts }

export const PALETTES: Record<string, string[]> = {
  office: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'],
  vivid: ['#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#42D4F4', '#F032E6', '#BFEF45'],
  pastel: ['#8FB8DE', '#F5B7B1', '#B5E2B1', '#F9E79F', '#D2B4DE', '#AED6F1', '#F8C471', '#A3E4D7'],
  ocean: ['#03396C', '#005B96', '#6497B1', '#B3CDE0', '#0E86D4', '#68BBE3', '#055C9D', '#2E8BC0'],
  sunset: ['#D1495B', '#EDAE49', '#00798C', '#30638E', '#003D5B', '#F79256', '#8D5B4C', '#FBC4AB'],
  mono: ['#222222', '#555555', '#888888', '#AAAAAA', '#CCCCCC', '#444444', '#777777', '#999999'],
  draco: ['#E4572E', '#29335C', '#F3A712', '#A8C686', '#669BBC', '#8F2D56', '#2D936C', '#F7B2AD'],
};
export const PALETTE_NAMES = Object.keys(PALETTES);
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const f1 = (n: number) => (Math.round(n * 100) / 100).toString();
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function renderChart(spec: ChartSpec, W = 480, H = 300): string {
  const o = spec.opts ?? {}; const dark = o.theme === 'dark';
  const pal = PALETTES[o.palette ?? 'office'] ?? PALETTES.office; const col = (i: number, s?: Series) => s?.color ?? pal[i % pal.length];
  const fg = dark ? '#e6e6e6' : '#333', mute = dark ? '#8a8a8a' : '#777', gridc = dark ? '#3a3a3a' : '#e3e3e3', bg = o.bg ?? (dark ? '#1e1e1e' : '#ffffff');
  const font = o.font ?? 'Segoe UI, Roboto, Arial, sans-serif'; const out: string[] = [];
  const t = spec.type; const cats = spec.categories; const ser = spec.series;
  const legendPos = o.legend ?? 'bottom'; const pieLike = t === 'pie' || t === 'doughnut' || t === 'treemap' || t === 'sunburst' || t === 'funnel';
  const showLegend = legendPos !== 'none' && t !== 'surface' && t !== 'surface3d' && t !== 'map' && (pieLike ? t !== 'treemap' && t !== 'funnel' : ser.length > 1 || t === 'waterfall');
  const titleH = spec.title ? 30 : 8; let L = 8, R = 8, T = titleH, B = 8;
  const legendItems: Array<{ name: string; color: string }> = pieLike ? cats.map((c, i) => ({ name: c, color: pal[i % pal.length] })) : t === 'waterfall' ? [{ name: 'Increase', color: '#70AD47' }, { name: 'Decrease', color: '#E4572E' }, { name: 'Total', color: '#4472C4' }] : ser.map((s, i) => ({ name: s.name, color: col(i, s) }));
  const legW = Math.min(150, maxOf(legendItems.map((l) => l.name.length), [4]) * 6.5 + 26);
  if (showLegend) { if (legendPos === 'bottom') B += 22; else if (legendPos === 'top') T += 22; else if (legendPos === 'left') L += legW; else R += legW; }
  const tName: string = t; const hasAxes = !pieLike && tName !== 'radar' && tName !== 'surface' && tName !== 'surface3d' && tName !== 'map';
  const secondary = ser.some((s) => s.secondary);
  if (hasAxes) { L += 44 + (o.yTitle ? 16 : 0); B += 26 + (o.xTitle ? 16 : 0); R += secondary ? 44 + (o.y2Title ? 16 : 0) : 6; T += 6; }
  const pw = W - L - R, ph = H - T - B;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(font)}" font-size="11" role="img" aria-label="${esc(spec.title ?? t + ' chart')}"><rect width="${W}" height="${H}" fill="${bg}"/>`);
  if (spec.title) out.push(`<text x="${W / 2}" y="20" text-anchor="middle" font-size="14" font-weight="600" fill="${fg}">${esc(spec.title)}</text>`);
  if (showLegend) {
    const fit = legendPos === 'left' || legendPos === 'right';
    let lx = legendPos === 'left' ? 8 : legendPos === 'right' ? W - legW - 4 : 0, ly = legendPos === 'top' ? titleH + 4 : legendPos === 'bottom' ? H - 18 : T + 8;
    if (!fit) { const tot = legendItems.reduce((a, l) => a + l.name.length * 6.2 + 24, 0); lx = Math.max(8, (W - tot) / 2); }
    for (const l of legendItems.slice(0, 24)) {
      out.push(`<rect x="${f1(lx)}" y="${f1(ly)}" width="10" height="10" rx="2" fill="${l.color}"/><text x="${f1(lx + 14)}" y="${f1(ly + 9)}" fill="${fg}">${esc(trunc(l.name, 22))}</text>`);
      if (fit) ly += 16; else lx += l.name.length * 6.2 + 24;
    }
  }
  const empty = () => { out.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${mute}">No data</text></svg>`); return out.join(''); };
  if (!ser.length || (!cats.length && !['scatter', 'bubble', 'histogram', 'box'].includes(t))) return empty();

  /* ----- pie / doughnut / sunburst ----- */
  if (t === 'pie' || t === 'doughnut' || t === 'sunburst') {
    const vals = (ser[0].values.map((v) => (isNum(v) && v > 0 ? v : 0)) as number[]); const tot = sum(vals); if (!tot) return empty();
    const cx = L + pw / 2, cy = T + ph / 2, r = Math.max(10, Math.min(pw, ph) / 2 - 6); const hole = t === 'pie' ? 0 : (o.hole ?? 0.55) * r;
    const arc = (r0: number, r1: number, a0: number, a1: number, fill: string, tip: string) => {
      const big = a1 - a0 > Math.PI ? 1 : 0; const p = (rr: number, a: number) => `${f1(cx + rr * Math.sin(a))} ${f1(cy - rr * Math.cos(a))}`;
      if (a1 - a0 >= Math.PI * 2 - 1e-9) a1 = a0 + Math.PI * 2 - 1e-6;
      const d = r0 > 0 ? `M${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)}Z` : `M${f1(cx)} ${f1(cy)}L${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}Z`;
      return `<path d="${d}" fill="${fill}" stroke="${bg}" stroke-width="1.5"><title>${esc(tip)}</title></path>`;
    };
    if (t === 'sunburst') {
      // categories "Parent/Child"; ring 1 = parents, ring 2 = children
      const groups = new Map<string, Array<{ n: string; v: number }>>(); cats.forEach((c, i) => { const [p, ch] = c.includes('/') ? c.split('/') : [c, '']; if (!groups.has(p)) groups.set(p, []); groups.get(p)!.push({ n: ch || p, v: vals[i] }); });
      const rIn = r * 0.15, rMid = r * 0.55; let a = 0; let gi = 0;
      for (const [p, kids] of groups) { const gv = sum(kids.map((k) => k.v)); const a1 = a + (gv / tot) * Math.PI * 2; const c = pal[gi % pal.length]; out.push(arc(rIn, rMid, a, a1, c, `${p}: ${fmtNum(gv)}`));
        let b = a; for (const k of kids) { const b1 = b + (k.v / tot) * Math.PI * 2; out.push(arc(rMid, r, b, b1, c + 'bb', `${p}/${k.n}: ${fmtNum(k.v)}`)); if (o.labels && b1 - b > 0.25) { const m = (b + b1) / 2, rr = (rMid + r) / 2; out.push(`<text x="${f1(cx + rr * Math.sin(m))}" y="${f1(cy - rr * Math.cos(m) + 3)}" text-anchor="middle" fill="#fff" font-size="9">${esc(trunc(k.n, 8))}</text>`); } b = b1; }
        a = a1; gi++; }
    } else {
      let a = 0; vals.forEach((v, i) => {
        if (!v) return; const a1 = a + (v / tot) * Math.PI * 2; out.push(arc(hole, r, a, a1, pal[i % pal.length], `${cats[i]}: ${fmtNum(v)} (${f1((v / tot) * 100)}%)`));
        if (o.labels) { const m = (a + a1) / 2, rr = hole ? (hole + r) / 2 : r * 0.65; if (a1 - a > 0.18) out.push(`<text x="${f1(cx + rr * Math.sin(m))}" y="${f1(cy - rr * Math.cos(m) + 4)}" text-anchor="middle" font-weight="600" fill="#fff">${f1((v / tot) * 100)}%</text>`); }
        a = a1;
      });
    }
    out.push('</svg>'); return out.join('');
  }

  /* ----- treemap ----- */
  if (t === 'treemap') {
    const rects = squarify(cats.map((c, i) => ({ label: c, value: (ser[0].values[i] as number) ?? 0 })), L, T, pw, ph);
    rects.forEach((r, i) => { out.push(`<g><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" fill="${pal[i % pal.length]}" stroke="${bg}" stroke-width="2"><title>${esc(r.label)}: ${fmtNum(r.value)}</title></rect>${r.w > 38 && r.h > 20 ? `<text x="${f1(r.x + 5)}" y="${f1(r.y + 14)}" fill="#fff" font-weight="600" font-size="11">${esc(trunc(r.label, Math.floor(r.w / 6.5)))}</text><text x="${f1(r.x + 5)}" y="${f1(r.y + 27)}" fill="#fff" font-size="10" opacity=".85">${fmtNum(r.value)}</text>` : ''}</g>`); });
    out.push('</svg>'); return out.join('');
  }

  /* ----- surface (top view: value bands as a heat grid) ----- */
  if (t === 'surface') {
    const all = clean(ser.flatMap((x) => x.values)); if (!all.length) return empty(); const lo = minOf(all), hi = maxOf(all);
    const ramp = ['#3B4CC0', '#6F92F3', '#AAC7FD', '#DDDDDD', '#F7B89C', '#E7745B', '#B40426']; const colorOf = (v: number) => ramp[Math.min(ramp.length - 1, Math.floor(((v - lo) / (hi - lo || 1)) * ramp.length))];
    const gw = pw - 70, cw = gw / ser.length, rh = ph / Math.max(1, cats.length) , gx = L + 40;
    cats.forEach((c, i) => { out.push(`<text x="${f1(gx - 4)}" y="${f1(T + i * rh + rh / 2 + 4)}" text-anchor="end" fill="${mute}">${esc(trunc(c, 6))}</text>`); ser.forEach((x, j) => { const v = x.values[i]; if (!isNum(v)) return; out.push(`<rect x="${f1(gx + j * cw)}" y="${f1(T + i * rh)}" width="${f1(cw)}" height="${f1(rh)}" fill="${colorOf(v)}" stroke="${bg}"><title>${esc(x.name)} · ${esc(c)}: ${fmtNum(v, false)}</title></rect>`); if (o.labels && cw > 22 && rh > 14) out.push(`<text x="${f1(gx + j * cw + cw / 2)}" y="${f1(T + i * rh + rh / 2 + 4)}" text-anchor="middle" fill="#222" font-size="10">${fmtNum(v)}</text>`); }); });
    ser.forEach((x, j) => out.push(`<text x="${f1(gx + j * cw + cw / 2)}" y="${f1(T + ph + 12)}" text-anchor="middle" fill="${mute}">${esc(trunc(x.name, Math.max(3, Math.floor(cw / 6.5))))}</text>`));
    ramp.forEach((c, k) => { const y = T + ph - (k + 1) * (ph / ramp.length); out.push(`<rect x="${f1(L + pw - 18)}" y="${f1(y)}" width="12" height="${f1(ph / ramp.length)}" fill="${c}"/>`); if (k % 3 === 0 || k === ramp.length - 1) out.push(`<text x="${f1(L + pw - 22)}" y="${f1(y + 9)}" text-anchor="end" fill="${mute}" font-size="10">${fmtNum(lo + ((hi - lo) * k) / ramp.length)}</text>`); });
    out.push('</svg>'); return out.join('');
  }

  /* ----- 3-D surface (v64): isometric mesh, painter's algorithm ----- */
  if (t === 'surface3d') {
    const all = clean(ser.flatMap((x) => x.values)); if (!all.length || ser.length < 2 || cats.length < 2) return empty(); const lo = minOf(all), hi = maxOf(all), span = hi - lo || 1;
    const ramp = ['#3B4CC0', '#6F92F3', '#AAC7FD', '#DDDDDD', '#F7B89C', '#E7745B', '#B40426']; const colorOf = (v: number) => ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(((v - lo) / span) * ramp.length)))];
    const az = ((o.azimuth ?? 35) * Math.PI) / 180, el = ((o.elevation ?? 30) * Math.PI) / 180; const nx = ser.length, ny = cats.length;
    const z = (i: number, j: number) => { const v = ser[j].values[i]; return isNum(v) ? v : lo; };
    const proj = (x: number, y: number, h: number) => { const X = x - 0.5, Y = y - 0.5; const rx = X * Math.cos(az) - Y * Math.sin(az), ry = X * Math.sin(az) + Y * Math.cos(az); return { x: rx, y: -(ry * Math.sin(el)) - (h - 0.5) * Math.cos(el) * 1.1, d: ry }; };
    const P: Array<Array<{ x: number; y: number; d: number }>> = []; for (let i = 0; i < ny; i++) { P.push([]); for (let j = 0; j < nx; j++) P[i].push(proj(j / (nx - 1), i / (ny - 1), (z(i, j) - lo) / span)); }
    const all2 = P.flat(); const bx0 = minOf(all2.map((p) => p.x)), bx1 = maxOf(all2.map((p) => p.x)), by0 = minOf(all2.map((p) => p.y)), by1 = maxOf(all2.map((p) => p.y));
    const sc = Math.min((pw - 70) / (bx1 - bx0 || 1), ph / (by1 - by0 || 1)), ox = L + (pw - 60) / 2 - ((bx0 + bx1) / 2) * sc, oy = T + ph / 2 - ((by0 + by1) / 2) * sc;
    const sx = (p: { x: number }) => f1(ox + p.x * sc), sy = (p: { y: number }) => f1(oy + p.y * sc);
    const quads: Array<{ d: number; svg: string }> = [];
    for (let i = 0; i < ny - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = P[i][j], b = P[i][j + 1], c = P[i + 1][j + 1], d = P[i + 1][j]; const m = (z(i, j) + z(i, j + 1) + z(i + 1, j + 1) + z(i + 1, j)) / 4;
      quads.push({ d: (a.d + b.d + c.d + d.d) / 4, svg: `<polygon points="${[a, b, c, d].map((p) => `${sx(p)},${sy(p)}`).join(' ')}" fill="${colorOf(m)}" stroke="${dark ? '#222' : '#fff'}" stroke-width=".6"><title>${esc(ser[j].name)} · ${esc(cats[i])}: ${fmtNum(m, false)}</title></polygon>` }); }
    quads.sort((p, q) => q.d - p.d).forEach((q) => out.push(q.svg));
    const base = [proj(0, 0, 0), proj(1, 0, 0), proj(1, 1, 0), proj(0, 1, 0)]; out.push(`<polygon points="${base.map((p) => `${sx(p)},${sy(p)}`).join(' ')}" fill="none" stroke="${mute}" stroke-dasharray="3 3"/>`);
    out.push(`<text x="${sx(proj(0, 0, 0))}" y="${f1(+sy(proj(0, 0, 0)) + 14)}" fill="${mute}" font-size="10">${esc(trunc(ser[0].name, 10))}</text><text x="${sx(proj(1, 0, 0))}" y="${f1(+sy(proj(1, 0, 0)) + 14)}" text-anchor="end" fill="${mute}" font-size="10">${esc(trunc(ser[nx - 1].name, 10))}</text>`);
    ramp.forEach((c, k) => { const y = T + ph - (k + 1) * (ph / ramp.length); out.push(`<rect x="${f1(L + pw - 18)}" y="${f1(y)}" width="12" height="${f1(ph / ramp.length)}" fill="${c}"/>`); if (k % 3 === 0 || k === ramp.length - 1) out.push(`<text x="${f1(L + pw - 22)}" y="${f1(y + 9)}" text-anchor="end" fill="${mute}" font-size="10">${fmtNum(lo + (span * k) / ramp.length)}</text>`); });
    out.push('</svg>'); return out.join('');
  }

  /* ----- map (v72): tile maps for US / India, bubble map for world ----- */
  if (t === 'map') {
    const kind: MapKind = o.map ?? 'us'; const vals = new Map<string, number>(); let miss = 0;
    cats.forEach((c, i) => { const r = resolveRegion(kind, c); const v = ser[0].values[i]; if (r && isNum(v)) vals.set(r[0], v); else miss++; });
    const nums = [...vals.values()]; if (!nums.length) return empty(); const lo = minOf(nums), hi = maxOf(nums);
    const ramp = ['#DCE9F7', '#B3D0EE', '#86B3E1', '#5B93D2', '#3A73BD', '#1F5299', '#103A73']; const colorOf = (v: number) => ramp[Math.min(ramp.length - 1, Math.floor(((v - lo) / (hi - lo || 1)) * ramp.length))];
    const legend = () => ramp.forEach((c, k) => { const y = T + ph - (k + 1) * (ph / ramp.length); out.push(`<rect x="${f1(L + pw - 16)}" y="${f1(y)}" width="10" height="${f1(ph / ramp.length)}" fill="${c}"/>`); if (k % 3 === 0 || k === ramp.length - 1) out.push(`<text x="${f1(L + pw - 20)}" y="${f1(y + 9)}" text-anchor="end" fill="${mute}" font-size="10">${fmtNum(lo + ((hi - lo) * k) / ramp.length)}</text>`); });
    if (kind === 'world') {
      const mw = pw - 40, mh = ph, X = (lon: number) => L + ((lon + 180) / 360) * mw, Y = (lat: number) => T + ((84 - lat) / 148) * mh;
      for (let lon = -180; lon <= 180; lon += 30) out.push(`<line x1="${f1(X(lon))}" y1="${f1(T)}" x2="${f1(X(lon))}" y2="${f1(T + mh)}" stroke="${gridc}"/>`);
      for (let lat = -60; lat <= 80; lat += 20) out.push(`<line x1="${f1(L)}" y1="${f1(Y(lat))}" x2="${f1(L + mw)}" y2="${f1(Y(lat))}" stroke="${gridc}"/>`);
      TABLE.world.forEach((r) => out.push(`<circle cx="${f1(X(r[2]))}" cy="${f1(Y(r[3]))}" r="2" fill="${mute}" opacity=".5"/>`));
      for (const [code, v] of vals) { const r = TABLE.world.find((x) => x[0] === code)!; const rad = 4 + Math.sqrt((v - lo) / (hi - lo || 1)) * 14; out.push(`<circle cx="${f1(X(r[2]))}" cy="${f1(Y(r[3]))}" r="${f1(rad)}" fill="${colorOf(v)}" fill-opacity=".8" stroke="${fg}" stroke-width=".6"><title>${esc(r[1])}: ${fmtNum(v, false)}</title></circle>`); if (o.labels && rad > 8) out.push(`<text x="${f1(X(r[2]))}" y="${f1(Y(r[3]) + 3)}" text-anchor="middle" font-size="8" fill="#fff">${code}</text>`); }
    } else {
      const tiles = TABLE[kind]; const cols = maxOf(tiles.map((r) => r[2])) + 1, rows = maxOf(tiles.map((r) => r[3])) + 1; const gw = pw - 28; const cs = Math.min(gw / cols, ph / rows); const ox = L + (gw - cs * cols) / 2, oy = T + (ph - cs * rows) / 2;
      for (const r of tiles) { const v = vals.get(r[0]); out.push(`<rect x="${f1(ox + r[2] * cs + 1)}" y="${f1(oy + r[3] * cs + 1)}" width="${f1(cs - 2)}" height="${f1(cs - 2)}" rx="3" fill="${v == null ? gridc : colorOf(v)}"><title>${esc(r[1])}${v == null ? '' : ': ' + fmtNum(v, false)}</title></rect><text x="${f1(ox + r[2] * cs + cs / 2)}" y="${f1(oy + r[3] * cs + cs / 2 + (o.labels && v != null ? -1 : 3))}" text-anchor="middle" font-size="${cs > 30 ? 10 : 8}" font-weight="600" fill="${v == null ? mute : (v - lo) / (hi - lo || 1) > 0.35 ? '#fff' : '#223'}">${r[0]}</text>${o.labels && v != null && cs > 28 ? `<text x="${f1(ox + r[2] * cs + cs / 2)}" y="${f1(oy + r[3] * cs + cs / 2 + 10)}" text-anchor="middle" font-size="8" fill="${(v - lo) / (hi - lo || 1) > 0.35 ? '#fff' : '#223'}">${fmtNum(v)}</text>` : ''}`); }
    }
    legend(); if (miss) out.push(`<text x="${L + 4}" y="${f1(T + ph - 2)}" fill="${mute}" font-size="9">${miss} label${miss > 1 ? 's' : ''} not matched</text>`);
    out.push('</svg>'); return out.join('');
  }

  /* ----- funnel ----- */
  if (t === 'funnel') {
    const v = cats.map((c, i) => ({ c, v: Math.max(0, (ser[0].values[i] as number) ?? 0) })); const mx = maxOf(v.map((x) => x.v), [1]); const bh = ph / v.length;
    v.forEach((x, i) => { const w = (x.v / mx) * pw, y = T + i * bh; const narrow = w < 110; out.push(`<rect x="${f1(L + (pw - w) / 2)}" y="${f1(y + 2)}" width="${f1(w)}" height="${f1(bh - 4)}" fill="${pal[i % pal.length]}"><title>${esc(x.c)}: ${fmtNum(x.v)}</title></rect><text x="${f1(narrow ? L + (pw + w) / 2 + 6 : L + pw / 2)}" y="${f1(y + bh / 2 + 4)}" text-anchor="${narrow ? 'start' : 'middle'}" fill="${narrow ? fg : '#fff'}" font-weight="600">${esc(trunc(x.c, 18))} · ${fmtNum(x.v)}</text>`); });
    out.push('</svg>'); return out.join('');
  }

  /* ----- radar ----- */
  if (t === 'radar') {
    const cx = L + pw / 2, cy = T + ph / 2, r = Math.max(10, Math.min(pw, ph) / 2 - 22), n = cats.length;
    const all = clean(ser.flatMap((s) => s.values)); const sc = niceScale(minOf(all, [0]), maxOf(all, [1]), 4);
    const ang = (i: number) => (i / n) * Math.PI * 2; const pt = (i: number, v: number) => { const rr = ((v - sc.min) / (sc.max - sc.min)) * r; return [cx + rr * Math.sin(ang(i)), cy - rr * Math.cos(ang(i))]; };
    for (const tk of sc.ticks.slice(1)) out.push(`<polygon points="${cats.map((_, i) => pt(i, tk).map(f1).join(',')).join(' ')}" fill="none" stroke="${gridc}"/>`);
    cats.forEach((c, i) => { const [x, y] = pt(i, sc.max); out.push(`<line x1="${f1(cx)}" y1="${f1(cy)}" x2="${f1(x)}" y2="${f1(y)}" stroke="${gridc}"/><text x="${f1(cx + (r + 12) * Math.sin(ang(i)))}" y="${f1(cy - (r + 12) * Math.cos(ang(i)) + 4)}" text-anchor="middle" fill="${fg}">${esc(trunc(c, 12))}</text>`); });
    ser.forEach((s, si) => { const pts = cats.map((_, i) => pt(i, (s.values[i] as number) ?? 0).map(f1).join(',')).join(' '); out.push(`<polygon points="${pts}" fill="${col(si, s)}" fill-opacity=".22" stroke="${col(si, s)}" stroke-width="2"/>`); });
    out.push('</svg>'); return out.join('');
  }

  /* ===== axis-based charts ===== */
  const horizontal = t === 'bar';
  type Pt = { cat: number; x?: number; y: number; y0: number };
  let xcat = cats.slice();
  // histogram / box transform data into bar/box primitives
  let vs = ser;
  if (t === 'histogram') {
    const bins = histogram(clean(ser[0].values), { bins: o.bins, width: o.binWidth }); xcat = bins.map((b, i) => `${i === 0 ? '[' : '('}${fmtNum(b.lo, false)}, ${fmtNum(b.hi, false)}]`); vs = [{ name: 'Count', values: bins.map((b) => b.count) }];
  }
  if (t === 'box') {
    const stats = ser.map((s) => boxStats(clean(s.values)));
    const all = clean(stats.flatMap((s) => (s ? [s.min, s.max, ...s.outliers] : []))); const sc = niceScale(minOf(all), maxOf(all));
    const yy = (v: number) => T + ph - ((v - sc.min) / (sc.max - sc.min)) * ph; const slot = pw / ser.length;
    for (const tk of sc.ticks) out.push(`<line x1="${L}" x2="${L + pw}" y1="${f1(yy(tk))}" y2="${f1(yy(tk))}" stroke="${gridc}"/><text x="${L - 6}" y="${f1(yy(tk) + 4)}" text-anchor="end" fill="${mute}">${fmtNum(tk)}</text>`);
    stats.forEach((s, i) => { if (!s) return; const cx = L + slot * (i + 0.5), bw = Math.min(60, slot * 0.5), c = col(i, ser[i]);
      out.push(`<g><title>${esc(ser[i].name)}: min ${fmtNum(s.min)}, Q1 ${fmtNum(s.q1)}, median ${fmtNum(s.median)}, Q3 ${fmtNum(s.q3)}, max ${fmtNum(s.max)}</title><line x1="${f1(cx)}" x2="${f1(cx)}" y1="${f1(yy(s.min))}" y2="${f1(yy(s.max))}" stroke="${fg}"/><line x1="${f1(cx - bw / 4)}" x2="${f1(cx + bw / 4)}" y1="${f1(yy(s.min))}" y2="${f1(yy(s.min))}" stroke="${fg}"/><line x1="${f1(cx - bw / 4)}" x2="${f1(cx + bw / 4)}" y1="${f1(yy(s.max))}" y2="${f1(yy(s.max))}" stroke="${fg}"/><rect x="${f1(cx - bw / 2)}" y="${f1(yy(s.q3))}" width="${f1(bw)}" height="${f1(Math.max(1, yy(s.q1) - yy(s.q3)))}" fill="${c}" fill-opacity=".55" stroke="${c}"/><line x1="${f1(cx - bw / 2)}" x2="${f1(cx + bw / 2)}" y1="${f1(yy(s.median))}" y2="${f1(yy(s.median))}" stroke="${fg}" stroke-width="2"/><text x="${f1(cx)}" y="${f1(cy0(T, ph) + 16)}" text-anchor="middle" fill="${mute}">${esc(trunc(ser[i].name, 12))}</text>`);
      out.push(`<text x="${f1(cx)}" y="${f1(yy(s.mean) + 4)}" text-anchor="middle" fill="${fg}" font-size="10">×</text>`);
      for (const ov of s.outliers) out.push(`<circle cx="${f1(cx)}" cy="${f1(yy(ov))}" r="3" fill="none" stroke="${c}"/>`); out.push('</g>'); });
    out.push('</svg>'); return out.join('');
  }
  function cy0(t0: number, p: number) { return t0 + p; }

  // y domain
  const prim = vs.filter((s) => !s.secondary), sec = vs.filter((s) => s.secondary);
  const stack = o.stack ?? 'none'; const stackable = t === 'column' || t === 'bar' || t === 'area' || t === 'histogram';
  const nCat = maxOf(vs.map((s) => s.values.length), [xcat.length]);
  function domain(list: Series[], isStack: boolean) {
    if (t === 'waterfall') { let run = 0, lo = 0, hi = 0; for (const v of list[0].values) { run += (v as number) ?? 0; lo = Math.min(lo, run); hi = Math.max(hi, run); } return [lo, hi]; }
    if (t === 'stock') return [minOf(clean(list.flatMap((s) => s.values))), maxOf(clean(list.flatMap((s) => s.values)))];
    let lo = Infinity, hi = -Infinity;
    if (isStack && stackable) { for (let i = 0; i < nCat; i++) { let pos = 0, neg = 0; for (const s of list) { const v = (s.values[i] as number) ?? 0; v >= 0 ? (pos += v) : (neg += v); } hi = Math.max(hi, pos); lo = Math.min(lo, neg); } lo = Math.min(lo, 0); }
    else for (const s of list) for (const v of s.values) if (isNum(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (o.err && !isStack) { for (const s of list) { const e = errAmt(s, o.err); for (const v of s.values) if (isNum(v)) { const d = e(v); lo = Math.min(lo, v - d); hi = Math.max(hi, v + d); } } }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    if (t === 'bubble') { const pd = (hi - lo || 1) * 0.15; lo -= pd; hi += pd; }
    if (t !== 'scatter' && t !== 'bubble' && t !== 'line') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    return [lo, hi];
  }
  const isPct = stack === 'percent' && stackable;
  let [pLo, pHi] = isPct ? [0, 100] : domain(prim.length ? prim : vs, stack !== 'none');
  const [sLo, sHi] = sec.length ? domain(sec, false) : [0, 1];
  const scaleOf = (lo: number, hi: number, log: boolean) => { if (log && lo > 0) { const s = logScale(Math.max(lo, 1e-9), hi); return { min: s.min, max: s.max, ticks: s.ticks, log: true }; } const s = niceScale(lo, hi, Math.max(3, Math.floor((horizontal ? pw : ph) / 45))); return { min: s.min, max: s.max, ticks: s.ticks, log: false }; };
  if (o.yMin != null) pLo = o.yMin; if (o.yMax != null) pHi = o.yMax;
  const ys = scaleOf(pLo, pHi, !!o.logY), ys2 = scaleOf(sLo, sHi, false);
  const frac = (sc: { min: number; max: number; log: boolean }, v: number) => (sc.log ? (Math.log10(Math.max(v, sc.min)) - Math.log10(sc.min)) / (Math.log10(sc.max) - Math.log10(sc.min)) : (v - sc.min) / (sc.max - sc.min));
  const Y = (v: number, sc = ys) => (horizontal ? L + frac(sc, v) * pw : T + ph - frac(sc, v) * ph);
  const isXY = t === 'scatter' || t === 'bubble';
  let xs: ReturnType<typeof scaleOf> | null = null;
  if (isXY) { const xv = clean(vs.flatMap((s) => s.xs ?? s.values.map((_, i) => i + 1))); const xl = minOf(xv), xh = maxOf(xv), xp = (xh - xl || 1) * (t === 'bubble' ? 0.12 : 0.04); xs = scaleOf(xl - xp, xh + xp, false); }
  const slot = (horizontal ? ph : pw) / Math.max(1, nCat);
  const catPos = (i: number) => (horizontal ? T + slot * (i + 0.5) : L + slot * (i + 0.5));
  const X = (i: number) => catPos(i);

  // grid + axes
  const gridOn = o.grid !== false;
  for (const tk of ys.ticks) { const p = Y(tk); const lab = isPct ? tk + '%' : fmtNum(tk);
    if (horizontal) out.push(`${gridOn ? `<line x1="${f1(p)}" x2="${f1(p)}" y1="${T}" y2="${T + ph}" stroke="${gridc}"/>` : ''}<text x="${f1(p)}" y="${T + ph + 14}" text-anchor="middle" fill="${mute}">${lab}</text>`);
    else out.push(`${gridOn ? `<line x1="${L}" x2="${L + pw}" y1="${f1(p)}" y2="${f1(p)}" stroke="${gridc}"/>` : ''}<text x="${L - 6}" y="${f1(p + 4)}" text-anchor="end" fill="${mute}">${lab}</text>`); }
  if (secondary) for (const tk of ys2.ticks) out.push(`<text x="${L + pw + 6}" y="${f1(Y(tk, ys2) + 4)}" fill="${mute}">${fmtNum(tk)}</text>`);
  out.push(`<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="${mute}"/><line x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}" stroke="${mute}"/>`);
  if (isXY && xs) { for (const tk of xs.ticks) { const px = L + frac(xs, tk) * pw; out.push(`${gridOn ? `<line x1="${f1(px)}" x2="${f1(px)}" y1="${T}" y2="${T + ph}" stroke="${gridc}"/>` : ''}<text x="${f1(px)}" y="${T + ph + 14}" text-anchor="middle" fill="${mute}">${fmtNum(tk)}</text>`); } }
  else { const every = Math.max(1, Math.ceil((horizontal ? 14 : 44) / slot)); xcat.forEach((c, i) => { if (i % every) return; out.push(horizontal ? `<text x="${L - 6}" y="${f1(catPos(i) + 4)}" text-anchor="end" fill="${mute}">${esc(trunc(c, 8))}</text>` : `<text x="${f1(catPos(i))}" y="${T + ph + 14}" text-anchor="middle" fill="${mute}">${esc(trunc(c, Math.max(3, Math.floor(slot * every / 6.5))))}</text>`); }); }
  if (o.xTitle) out.push(`<text x="${L + pw / 2}" y="${H - B + (showLegend && legendPos === 'bottom' ? 0 : 20) + 14 - (showLegend && legendPos === 'bottom' ? 0 : 0)}" text-anchor="middle" fill="${fg}" font-weight="600">${esc(o.xTitle)}</text>`);
  if (o.yTitle) out.push(`<text transform="translate(12 ${T + ph / 2}) rotate(-90)" text-anchor="middle" fill="${fg}" font-weight="600">${esc(o.yTitle)}</text>`);
  if (o.y2Title && secondary) out.push(`<text transform="translate(${W - (showLegend && legendPos === 'right' ? legW : 0) - 8} ${T + ph / 2}) rotate(90)" text-anchor="middle" fill="${fg}" font-weight="600">${esc(o.y2Title)}</text>`);

  const lbl = (x: number, y: number, v: number, anchor = 'middle') => (o.labels ? `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" fill="${fg}" font-size="10">${isPct ? '' : ''}${fmtNum(v)}</text>` : '');
  function errAmt(s: Series, e: NonNullable<ChartOpts['err']>) { const sd = stdev(clean(s.values)); return (v: number) => (e.kind === 'fixed' ? e.value ?? 1 : e.kind === 'pct' ? Math.abs(v) * ((e.value ?? 5) / 100) : sd * (e.value ?? 1)); }
  const barKinds = vs.map((s, i) => ({ s, i })).filter(({ s }) => (t === 'combo' ? (s.kind ?? 'column') === 'column' : t === 'column' || t === 'bar' || t === 'histogram'));

  // waterfall
  if (t === 'waterfall') {
    let run = 0; const s = vs[0]; const bw = slot * 0.62;
    s.values.forEach((raw, i) => { const v = (raw as number) ?? 0; const isTotal = /^total$/i.test(xcat[i] ?? ''); const start = isTotal ? 0 : run; const end = isTotal ? run : run + v; if (!isTotal) run = end;
      const y0 = Y(Math.min(start, end)), y1 = Y(Math.max(start, end)); const c = isTotal ? '#4472C4' : v >= 0 ? '#70AD47' : '#E4572E';
      out.push(`<rect x="${f1(X(i) - bw / 2)}" y="${f1(y1)}" width="${f1(bw)}" height="${f1(Math.max(1, y0 - y1))}" fill="${c}"><title>${esc(xcat[i])}: ${v >= 0 ? '+' : ''}${fmtNum(isTotal ? run : v)}</title></rect>`);
      if (i < s.values.length - 1) out.push(`<line x1="${f1(X(i) + bw / 2)}" x2="${f1(X(i + 1) - bw / 2)}" y1="${f1(Y(end))}" y2="${f1(Y(end))}" stroke="${mute}" stroke-dasharray="2 2"/>`);
      out.push(lbl(X(i), y1 - 4, isTotal ? run : v)); });
  }
  // stock (OHLC or HLC: series = open, high, low, close)
  else if (t === 'stock') {
    const get = (k: number, i: number) => vs[k]?.values[i] as number | null; const hasO = vs.length >= 4; const [hi, lo, cl, op] = hasO ? [1, 2, 3, 0] : [0, 1, 2, -1];
    for (let i = 0; i < nCat; i++) { const h = get(hi, i), l = get(lo, i), c = get(cl, i), op_ = op >= 0 ? get(op, i) : null; if (![h, l, c].every(isNum)) continue; const up = op_ == null || c! >= op_!; const cc = up ? '#2D936C' : '#D1495B'; const bw = Math.min(14, slot * 0.5);
      out.push(`<g stroke="${cc}"><title>${esc(xcat[i])} H ${h} L ${l} C ${c}${op_ != null ? ' O ' + op_ : ''}</title><line x1="${f1(X(i))}" x2="${f1(X(i))}" y1="${f1(Y(h!))}" y2="${f1(Y(l!))}"/>${op_ != null ? `<rect x="${f1(X(i) - bw / 2)}" y="${f1(Y(Math.max(op_, c!)))}" width="${f1(bw)}" height="${f1(Math.max(1, Math.abs(Y(op_) - Y(c!))))}" fill="${cc}"/>` : `<line x1="${f1(X(i))}" x2="${f1(X(i) + 5)}" y1="${f1(Y(c!))}" y2="${f1(Y(c!))}"/>`}</g>`); }
  }
  else {
    // bars (column / bar / histogram / combo-column), supports stacking
    const nb = barKinds.length; const gap = t === 'histogram' ? 0.02 : 0.2; const stackedBars = stack !== 'none' && stackable;
    const grp = slot * (1 - gap * 2); const bw = stackedBars ? grp : grp / Math.max(1, nb);
    const base = new Map<number, [number, number]>();
    barKinds.forEach(({ s, i: si }, k) => {
      const useSec = !!s.secondary; const sc = useSec ? ys2 : ys;
      s.values.forEach((raw, i) => { if (!isNum(raw)) return; let v = raw as number; let from = 0;
        if (stackedBars) { const tot = isPct ? sum(barKinds.map(({ s: q }) => Math.abs((q.values[i] as number) ?? 0))) || 1 : 1; if (isPct) v = (v / tot) * 100; const [pos, neg] = base.get(i) ?? [0, 0]; if (v >= 0) { from = pos; base.set(i, [pos + v, neg]); } else { from = neg; base.set(i, [pos, neg + v]); } }
        const a = horizontal ? Y(from, sc) : Y(from, sc), b = horizontal ? Y(from + v, sc) : Y(from + v, sc);
        const off = stackedBars ? 0 : k * bw; const c = col(si, s);
        const tip = `${s.name} · ${xcat[i]}: ${fmtNum(raw as number, false)}`;
        if (horizontal) out.push(`<rect x="${f1(Math.min(a, b))}" y="${f1(slot * i + T + slot * gap + off)}" width="${f1(Math.abs(b - a))}" height="${f1(bw - 1)}" fill="${c}"><title>${esc(tip)}</title></rect>${lbl(Math.max(a, b) + 3, slot * i + T + slot * gap + off + bw / 2 + 3, raw as number, 'start')}`);
        else out.push(`<rect x="${f1(L + slot * i + slot * gap + off)}" y="${f1(Math.min(a, b))}" width="${f1(Math.max(1, bw - 1))}" height="${f1(Math.max(0.5, Math.abs(b - a)))}" fill="${c}"><title>${esc(tip)}</title></rect>${lbl(L + slot * i + slot * gap + off + bw / 2, Math.min(a, b) - 3, raw as number)}`);
        if (o.err && !stackedBars) { const d = errAmt(s, o.err)(raw as number); const cx = L + slot * i + slot * gap + off + bw / 2; out.push(`<g stroke="${fg}"><line x1="${f1(cx)}" x2="${f1(cx)}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v - d, sc))}"/><line x1="${f1(cx - 3)}" x2="${f1(cx + 3)}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v + d, sc))}"/><line x1="${f1(cx - 3)}" x2="${f1(cx + 3)}" y1="${f1(Y(v - d, sc))}" y2="${f1(Y(v - d, sc))}"/></g>`); }
      });
    });
    // lines & areas (line / area / combo)
    const lineKinds = vs.map((s, i) => ({ s, i })).filter(({ s }) => (t === 'combo' ? s.kind === 'line' || s.kind === 'area' : t === 'line' || t === 'area'));
    const areaBase = new Map<number, number>();
    lineKinds.forEach(({ s, i: si }) => {
      const sc = s.secondary ? ys2 : ys; const c = col(si, s); const isArea = t === 'area' || s.kind === 'area'; const stackedArea = isArea && stack !== 'none';
      const pts: Array<[number, number, number]> = [];
      s.values.forEach((raw, i) => { if (!isNum(raw)) return; let v = raw as number; let from = 0; if (stackedArea) { const tot = isPct ? sum(lineKinds.map(({ s: q }) => Math.abs((q.values[i] as number) ?? 0))) || 1 : 1; if (isPct) v = (v / tot) * 100; from = areaBase.get(i) ?? 0; areaBase.set(i, from + v); v = from + v; } pts.push([X(i), Y(v, sc), Y(from, sc)]); });
      if (!pts.length) return;
      const path = (arr: Array<[number, number]>) => { if (!o.smooth || arr.length < 3) return 'M' + arr.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L'); let d = `M${f1(arr[0][0])} ${f1(arr[0][1])}`; for (let i = 0; i < arr.length - 1; i++) { const p0 = arr[i - 1] ?? arr[i], p1 = arr[i], p2 = arr[i + 1], p3 = arr[i + 2] ?? p2; d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`; } return d; };
      if (isArea) out.push(`<path d="${path(pts.map((p) => [p[0], p[1]]))}L${f1(pts[pts.length - 1][0])} ${f1(pts[pts.length - 1][2])}L${f1(pts[0][0])} ${f1(pts[0][2])}Z" fill="${c}" fill-opacity="${stackedArea ? 0.85 : 0.35}" stroke="${c}" stroke-width="1.5"/>`.replace(/(C[^L]*)L(\d)/, '$1L$2'));
      else { out.push(`<path d="${path(pts.map((p) => [p[0], p[1]]))}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`); if (o.markers !== false) pts.forEach((p, k) => out.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="3.2" fill="${bg}" stroke="${c}" stroke-width="1.8"><title>${esc(s.name)} · ${esc(xcat[k] ?? '')}</title></circle>`)); }
      if (o.labels) s.values.forEach((v, i) => { if (isNum(v)) out.push(lbl(X(i), Y(v, sc) - 6, v)); });
      if (o.err) { const e = errAmt(s, o.err); s.values.forEach((v, i) => { if (!isNum(v)) return; const d = e(v); out.push(`<g stroke="${fg}"><line x1="${f1(X(i))}" x2="${f1(X(i))}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v - d, sc))}"/><line x1="${f1(X(i) - 3)}" x2="${f1(X(i) + 3)}" y1="${f1(Y(v + d, sc))}" y2="${f1(Y(v + d, sc))}"/><line x1="${f1(X(i) - 3)}" x2="${f1(X(i) + 3)}" y1="${f1(Y(v - d, sc))}" y2="${f1(Y(v - d, sc))}"/></g>`); }); }
    });
    // scatter / bubble
    if (isXY && xs) {
      const maxS = maxOf(clean(vs.flatMap((s) => s.sizes ?? [])), [1]);
      vs.forEach((s, si) => { const c = col(si, s); s.values.forEach((v, i) => { if (!isNum(v)) return; const x = s.xs?.[i] ?? i + 1; const r = t === 'bubble' ? 4 + Math.sqrt((s.sizes?.[i] ?? 1) / maxS) * 22 : 4;
        out.push(`<circle cx="${f1(L + frac(xs!, x) * pw)}" cy="${f1(Y(v))}" r="${f1(r)}" fill="${c}" fill-opacity="${t === 'bubble' ? 0.55 : 0.85}" stroke="${c}"><title>${esc(s.name)}: (${fmtNum(x, false)}, ${fmtNum(v, false)})${t === 'bubble' ? ' size ' + fmtNum(s.sizes?.[i] ?? 0) : ''}</title></circle>`);
        if (o.labels) out.push(lbl(L + frac(xs!, x) * pw, Y(v) - r - 3, v)); }); });
    }
    // trendline(s)
    if (o.trend) {
      vs.forEach((s, si) => { const pts = s.values.map((v, i) => [isXY ? s.xs?.[i] ?? i + 1 : i + 1, v] as const).filter((p): p is [number, number] => isNum(p[1])); const xsA = pts.map((p) => p[0]), ysA = pts.map((p) => p[1]); const c = col(si, s); const tr = o.trend!;
        const toPx = (x: number, y: number) => [isXY && xs ? L + frac(xs, x) * pw : X(x - 1), Y(y)] as const;
        if (tr.type === 'ma') { const ma = movingAverage(s.values.map((v) => (isNum(v) ? v : 0)), tr.period ?? 2); const d = ma.map((v, i) => (v == null ? null : toPx(i + 1, v))).filter(Boolean) as Array<readonly [number, number]>; if (d.length > 1) out.push(`<path d="M${d.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}" fill="none" stroke="${c}" stroke-dasharray="5 4" stroke-width="1.8"><title>Moving average (${tr.period ?? 2})</title></path>`); return; }
        let fit: Fit | null = null; if (tr.type === 'linear') fit = linearFit(xsA, ysA); else if (tr.type === 'exp') fit = expFit(xsA, ysA); else if (tr.type === 'log') fit = logFit(xsA, ysA); else if (tr.type === 'power') fit = powerFit(xsA, ysA); else if (tr.type === 'poly') fit = polyFit(xsA, ysA, tr.degree ?? 2);
        if (!fit) return; const x0 = minOf(xsA), x1 = maxOf(xsA) + (tr.forward ?? 0); const N = 40; const line: string[] = [];
        for (let k = 0; k <= N; k++) { const x = x0 + ((x1 - x0) * k) / N; const y = fit.predict(x); if (!Number.isFinite(y)) continue; const [px, py] = toPx(x, Math.min(Math.max(y, ys.min), ys.max)); line.push(`${f1(px)} ${f1(py)}`); }
        out.push(`<path d="M${line.join('L')}" fill="none" stroke="${c}" stroke-dasharray="6 4" stroke-width="1.8"><title>${esc(tr.type)} trend · R² ${f1(fit.r2)}</title></path>`);
        if (tr.showEq || tr.showR2) out.push(`<text x="${L + pw - 4}" y="${T + 14 + si * 14}" text-anchor="end" fill="${c}" font-size="10">${tr.showEq ? esc(fit.equation) : ''}${tr.showEq && tr.showR2 ? '  ' : ''}${tr.showR2 ? 'R² = ' + f1(fit.r2) : ''}</text>`); });
    }
  }
  out.push('</svg>'); return out.join('');
}

/** Ready-made chart from a rectangular block. Header row detected when any non-first cell is text; first column is categories when it is text (or x-values for scatter/bubble). */
export function specFromGrid(grid: Array<Array<string | number | null>>, type: ChartType, title = ''): ChartSpec {
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v.replace(/[,$%\s]/g, '')) ? +v.replace(/[,$%\s]/g, '') : null);
  const cols = grid[0]?.length ?? 0; if (!grid.length || !cols) return { type, title, categories: [], series: [], opts: {} };
  const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '' && num(v) == null;
  const hasHeader = grid.length > 1 && grid[0].some((v, i) => i > 0 && isText(v)) || (grid.length > 1 && cols === 1 && isText(grid[0][0]));
  const body = hasHeader ? grid.slice(1) : grid; const head = hasHeader ? grid[0] : grid[0].map((_, i) => `Series ${i + 1}`);
  const xy = type === 'scatter' || type === 'bubble';
  const textCol0 = cols > 1 && body.some((r) => isText(r[0]));
  const firstIsX = xy && cols > 1; const firstIsCat = !xy && textCol0;
  const start = firstIsX || firstIsCat ? 1 : 0;
  const categories = firstIsCat ? body.map((r) => String(r[0] ?? '')) : xy ? [] : body.map((_, i) => String(i + 1));
  const dataCols = Array.from({ length: cols - start }, (_, i) => i + start);
  let series: Series[];
  if (xy) { const xsv = body.map((r, i) => (firstIsX ? num(r[0]) ?? i + 1 : i + 1)); const yc = type === 'bubble' ? dataCols.slice(0, 1) : dataCols;
    series = yc.map((c) => ({ name: String(head[c] ?? `Series ${c + 1}`), values: body.map((r) => num(r[c])), xs: xsv, sizes: type === 'bubble' ? body.map((r) => num(r[c + 1]) ?? 1) : undefined })); }
  else series = dataCols.map((c) => ({ name: String(head[c] ?? `Series ${c + 1}`), values: body.map((r) => num(r[c])) }));
  return { type, title, categories, series, opts: {} };
}

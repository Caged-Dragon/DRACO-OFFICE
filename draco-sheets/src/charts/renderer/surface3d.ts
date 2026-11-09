import { clean, fmtNum, isNum } from '../math';
import { maxOf, minOf } from '../../formulas/safeMath';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** surface3d chart renderer. */
export function renderSurface3d(c: RenderCtx): string {
  const { o, dark, mute, font, out, cats, ser, L, T, pw, ph, empty } = c;
  const all = clean(ser.flatMap((x) => x.values));
  if (!all.length || ser.length < 2 || cats.length < 2) return empty();
  const lo = minOf(all),
    hi = maxOf(all),
    span = hi - lo || 1;
  const ramp = ['#3B4CC0', '#6F92F3', '#AAC7FD', '#DDDDDD', '#F7B89C', '#E7745B', '#B40426'];
  const colorOf = (v: number) =>
    ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(((v - lo) / span) * ramp.length)))];
  const az = ((o.azimuth ?? 35) * Math.PI) / 180,
    el = ((o.elevation ?? 30) * Math.PI) / 180;
  const nx = ser.length,
    ny = cats.length;
  const z = (i: number, j: number) => {
    const v = ser[j].values[i];
    return isNum(v) ? v : lo;
  };
  const proj = (x: number, y: number, h: number) => {
    const X = x - 0.5,
      Y = y - 0.5;
    const rx = X * Math.cos(az) - Y * Math.sin(az),
      ry = X * Math.sin(az) + Y * Math.cos(az);
    return { x: rx, y: -(ry * Math.sin(el)) - (h - 0.5) * Math.cos(el) * 1.1, d: ry };
  };
  const P: Array<Array<{ x: number; y: number; d: number }>> = [];
  for (let i = 0; i < ny; i++) {
    P.push([]);
    for (let j = 0; j < nx; j++) P[i].push(proj(j / (nx - 1), i / (ny - 1), (z(i, j) - lo) / span));
  }
  const all2 = P.flat();
  const bx0 = minOf(all2.map((p) => p.x)),
    bx1 = maxOf(all2.map((p) => p.x)),
    by0 = minOf(all2.map((p) => p.y)),
    by1 = maxOf(all2.map((p) => p.y));
  const sc = Math.min((pw - 70) / (bx1 - bx0 || 1), ph / (by1 - by0 || 1)),
    ox = L + (pw - 60) / 2 - ((bx0 + bx1) / 2) * sc,
    oy = T + ph / 2 - ((by0 + by1) / 2) * sc;
  const sx = (p: { x: number }) => f1(ox + p.x * sc),
    sy = (p: { y: number }) => f1(oy + p.y * sc);
  const quads: Array<{ d: number; svg: string }> = [];
  for (let i = 0; i < ny - 1; i++)
    for (let j = 0; j < nx - 1; j++) {
      const a = P[i][j],
        b = P[i][j + 1],
        c = P[i + 1][j + 1],
        d = P[i + 1][j];
      const m = (z(i, j) + z(i, j + 1) + z(i + 1, j + 1) + z(i + 1, j)) / 4;
      quads.push({
        d: (a.d + b.d + c.d + d.d) / 4,
        svg: `<polygon points="${[a, b, c, d].map((p) => `${sx(p)},${sy(p)}`).join(' ')}" fill="${colorOf(m)}" stroke="${dark ? '#222' : '#fff'}" stroke-width=".6"><title>${esc(ser[j].name)} · ${esc(cats[i])}: ${fmtNum(m, false)}</title></polygon>`,
      });
    }
  quads.sort((p, q) => q.d - p.d).forEach((q) => out.push(q.svg));
  const base = [proj(0, 0, 0), proj(1, 0, 0), proj(1, 1, 0), proj(0, 1, 0)];
  out.push(
    `<polygon points="${base.map((p) => `${sx(p)},${sy(p)}`).join(' ')}" fill="none" stroke="${mute}" stroke-dasharray="3 3"/>`,
  );
  out.push(
    `<text x="${sx(proj(0, 0, 0))}" y="${f1(+sy(proj(0, 0, 0)) + 14)}" fill="${mute}" font-size="10">${esc(trunc(ser[0].name, 10))}</text><text x="${sx(proj(1, 0, 0))}" y="${f1(+sy(proj(1, 0, 0)) + 14)}" text-anchor="end" fill="${mute}" font-size="10">${esc(trunc(ser[nx - 1].name, 10))}</text>`,
  );
  ramp.forEach((c, k) => {
    const y = T + ph - (k + 1) * (ph / ramp.length);
    out.push(`<rect x="${f1(L + pw - 18)}" y="${f1(y)}" width="12" height="${f1(ph / ramp.length)}" fill="${c}"/>`);
    if (k % 3 === 0 || k === ramp.length - 1)
      out.push(
        `<text x="${f1(L + pw - 22)}" y="${f1(y + 9)}" text-anchor="end" fill="${mute}" font-size="10">${fmtNum(lo + (span * k) / ramp.length)}</text>`,
      );
  });
  out.push('</svg>');
  return out.join('');
}

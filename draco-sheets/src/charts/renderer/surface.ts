import { clean, fmtNum, isNum } from '../math';
import { maxOf, minOf } from '../../formulas/safeMath';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** surface chart renderer. */
export function renderSurface(c: RenderCtx): string {
  const { o, mute, bg, font, out, cats, ser, L, T, pw, ph, empty } = c;
  const all = clean(ser.flatMap((x) => x.values));
  if (!all.length) return empty();
  const lo = minOf(all),
    hi = maxOf(all);
  const ramp = ['#3B4CC0', '#6F92F3', '#AAC7FD', '#DDDDDD', '#F7B89C', '#E7745B', '#B40426'];
  const colorOf = (v: number) => ramp[Math.min(ramp.length - 1, Math.floor(((v - lo) / (hi - lo || 1)) * ramp.length))];
  const gw = pw - 70,
    cw = gw / ser.length,
    rh = ph / Math.max(1, cats.length),
    gx = L + 40;
  cats.forEach((c, i) => {
    out.push(
      `<text x="${f1(gx - 4)}" y="${f1(T + i * rh + rh / 2 + 4)}" text-anchor="end" fill="${mute}">${esc(trunc(c, 6))}</text>`,
    );
    ser.forEach((x, j) => {
      const v = x.values[i];
      if (!isNum(v)) return;
      out.push(
        `<rect x="${f1(gx + j * cw)}" y="${f1(T + i * rh)}" width="${f1(cw)}" height="${f1(rh)}" fill="${colorOf(v)}" stroke="${bg}"><title>${esc(x.name)} · ${esc(c)}: ${fmtNum(v, false)}</title></rect>`,
      );
      if (o.labels && cw > 22 && rh > 14)
        out.push(
          `<text x="${f1(gx + j * cw + cw / 2)}" y="${f1(T + i * rh + rh / 2 + 4)}" text-anchor="middle" fill="#222" font-size="10">${fmtNum(v)}</text>`,
        );
    });
  });
  ser.forEach((x, j) =>
    out.push(
      `<text x="${f1(gx + j * cw + cw / 2)}" y="${f1(T + ph + 12)}" text-anchor="middle" fill="${mute}">${esc(trunc(x.name, Math.max(3, Math.floor(cw / 6.5))))}</text>`,
    ),
  );
  ramp.forEach((c, k) => {
    const y = T + ph - (k + 1) * (ph / ramp.length);
    out.push(`<rect x="${f1(L + pw - 18)}" y="${f1(y)}" width="12" height="${f1(ph / ramp.length)}" fill="${c}"/>`);
    if (k % 3 === 0 || k === ramp.length - 1)
      out.push(
        `<text x="${f1(L + pw - 22)}" y="${f1(y + 9)}" text-anchor="end" fill="${mute}" font-size="10">${fmtNum(lo + ((hi - lo) * k) / ramp.length)}</text>`,
      );
  });
  out.push('</svg>');
  return out.join('');
}

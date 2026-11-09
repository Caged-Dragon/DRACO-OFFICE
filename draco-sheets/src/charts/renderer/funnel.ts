import { fmtNum } from '../math';
import { maxOf } from '../../formulas/safeMath';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** funnel chart renderer. */
export function renderFunnel(c: RenderCtx): string {
  const { pal, fg, font, out, cats, ser, L, T, pw, ph } = c;
  const v = cats.map((c, i) => ({ c, v: Math.max(0, (ser[0].values[i] as number) ?? 0) }));
  const mx = maxOf(
    v.map((x) => x.v),
    [1],
  );
  const bh = ph / v.length;
  v.forEach((x, i) => {
    const w = (x.v / mx) * pw,
      y = T + i * bh;
    const narrow = w < 110;
    out.push(
      `<rect x="${f1(L + (pw - w) / 2)}" y="${f1(y + 2)}" width="${f1(w)}" height="${f1(bh - 4)}" fill="${pal[i % pal.length]}"><title>${esc(x.c)}: ${fmtNum(x.v)}</title></rect><text x="${f1(narrow ? L + (pw + w) / 2 + 6 : L + pw / 2)}" y="${f1(y + bh / 2 + 4)}" text-anchor="${narrow ? 'start' : 'middle'}" fill="${narrow ? fg : '#fff'}" font-weight="600">${esc(trunc(x.c, 18))} · ${fmtNum(x.v)}</text>`,
    );
  });
  out.push('</svg>');
  return out.join('');
}

import { fmtNum, squarify } from '../math';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** treemap chart renderer. */
export function renderTreemap(c: RenderCtx): string {
  const { pal, bg, font, out, cats, ser, L, T, pw, ph } = c;
  const rects = squarify(
    cats.map((c, i) => ({ label: c, value: (ser[0].values[i] as number) ?? 0 })),
    L,
    T,
    pw,
    ph,
  );
  rects.forEach((r, i) => {
    out.push(
      `<g><rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" fill="${pal[i % pal.length]}" stroke="${bg}" stroke-width="2"><title>${esc(r.label)}: ${fmtNum(r.value)}</title></rect>${r.w > 38 && r.h > 20 ? `<text x="${f1(r.x + 5)}" y="${f1(r.y + 14)}" fill="#fff" font-weight="600" font-size="11">${esc(trunc(r.label, Math.floor(r.w / 6.5)))}</text><text x="${f1(r.x + 5)}" y="${f1(r.y + 27)}" fill="#fff" font-size="10" opacity=".85">${fmtNum(r.value)}</text>` : ''}</g>`,
    );
  });
  out.push('</svg>');
  return out.join('');
}

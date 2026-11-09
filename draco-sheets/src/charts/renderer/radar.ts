import { clean, niceScale } from '../math';
import { maxOf, minOf } from '../../formulas/safeMath';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** radar chart renderer. */
export function renderRadar(c: RenderCtx): string {
  const { col, fg, gridc, out, cats, ser, L, T, pw, ph } = c;
  const cx = L + pw / 2,
    cy = T + ph / 2,
    r = Math.max(10, Math.min(pw, ph) / 2 - 22),
    n = cats.length;
  const all = clean(ser.flatMap((s) => s.values));
  const sc = niceScale(minOf(all, [0]), maxOf(all, [1]), 4);
  const ang = (i: number) => (i / n) * Math.PI * 2;
  const pt = (i: number, v: number) => {
    const rr = ((v - sc.min) / (sc.max - sc.min)) * r;
    return [cx + rr * Math.sin(ang(i)), cy - rr * Math.cos(ang(i))];
  };
  for (const tk of sc.ticks.slice(1))
    out.push(
      `<polygon points="${cats.map((_, i) => pt(i, tk).map(f1).join(',')).join(' ')}" fill="none" stroke="${gridc}"/>`,
    );
  cats.forEach((c, i) => {
    const [x, y] = pt(i, sc.max);
    out.push(
      `<line x1="${f1(cx)}" y1="${f1(cy)}" x2="${f1(x)}" y2="${f1(y)}" stroke="${gridc}"/><text x="${f1(cx + (r + 12) * Math.sin(ang(i)))}" y="${f1(cy - (r + 12) * Math.cos(ang(i)) + 4)}" text-anchor="middle" fill="${fg}">${esc(trunc(c, 12))}</text>`,
    );
  });
  ser.forEach((s, si) => {
    const pts = cats
      .map((_, i) =>
        pt(i, (s.values[i] as number) ?? 0)
          .map(f1)
          .join(','),
      )
      .join(' ');
    out.push(
      `<polygon points="${pts}" fill="${col(si, s)}" fill-opacity=".22" stroke="${col(si, s)}" stroke-width="2"/>`,
    );
  });
  out.push('</svg>');
  return out.join('');
}

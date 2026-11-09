import { fmtNum, isNum, sum } from '../math';
import { esc, f1, trunc } from './util';
import type { RenderCtx } from './ctx';

/** pie chart renderer. */
export function renderPie(c: RenderCtx): string {
  const { o, pal, bg, font, out, t, cats, ser, L, T, pw, ph, empty } = c;
  const vals = ser[0].values.map((v) => (isNum(v) && v > 0 ? v : 0)) as number[];
  const tot = sum(vals);
  if (!tot) return empty();
  const cx = L + pw / 2,
    cy = T + ph / 2,
    r = Math.max(10, Math.min(pw, ph) / 2 - 6);
  const hole = t === 'pie' ? 0 : (o.hole ?? 0.55) * r;
  const arc = (r0: number, r1: number, a0: number, a1: number, fill: string, tip: string) => {
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rr: number, a: number) => `${f1(cx + rr * Math.sin(a))} ${f1(cy - rr * Math.cos(a))}`;
    if (a1 - a0 >= Math.PI * 2 - 1e-9) a1 = a0 + Math.PI * 2 - 1e-6;
    const d =
      r0 > 0
        ? `M${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)}Z`
        : `M${f1(cx)} ${f1(cy)}L${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}Z`;
    return `<path d="${d}" fill="${fill}" stroke="${bg}" stroke-width="1.5"><title>${esc(tip)}</title></path>`;
  };
  if (t === 'sunburst') {
    // categories "Parent/Child"; ring 1 = parents, ring 2 = children
    const groups = new Map<string, Array<{ n: string; v: number }>>();
    cats.forEach((c, i) => {
      const [p, ch] = c.includes('/') ? c.split('/') : [c, ''];
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p)!.push({ n: ch || p, v: vals[i] });
    });
    const rIn = r * 0.15,
      rMid = r * 0.55;
    let a = 0;
    let gi = 0;
    for (const [p, kids] of groups) {
      const gv = sum(kids.map((k) => k.v));
      const a1 = a + (gv / tot) * Math.PI * 2;
      const c = pal[gi % pal.length];
      out.push(arc(rIn, rMid, a, a1, c, `${p}: ${fmtNum(gv)}`));
      let b = a;
      for (const k of kids) {
        const b1 = b + (k.v / tot) * Math.PI * 2;
        out.push(arc(rMid, r, b, b1, c + 'bb', `${p}/${k.n}: ${fmtNum(k.v)}`));
        if (o.labels && b1 - b > 0.25) {
          const m = (b + b1) / 2,
            rr = (rMid + r) / 2;
          out.push(
            `<text x="${f1(cx + rr * Math.sin(m))}" y="${f1(cy - rr * Math.cos(m) + 3)}" text-anchor="middle" fill="#fff" font-size="9">${esc(trunc(k.n, 8))}</text>`,
          );
        }
        b = b1;
      }
      a = a1;
      gi++;
    }
  } else {
    let a = 0;
    vals.forEach((v, i) => {
      if (!v) return;
      const a1 = a + (v / tot) * Math.PI * 2;
      out.push(arc(hole, r, a, a1, pal[i % pal.length], `${cats[i]}: ${fmtNum(v)} (${f1((v / tot) * 100)}%)`));
      if (o.labels) {
        const m = (a + a1) / 2,
          rr = hole ? (hole + r) / 2 : r * 0.65;
        if (a1 - a > 0.18)
          out.push(
            `<text x="${f1(cx + rr * Math.sin(m))}" y="${f1(cy - rr * Math.cos(m) + 4)}" text-anchor="middle" font-weight="600" fill="#fff">${f1((v / tot) * 100)}%</text>`,
          );
      }
      a = a1;
    });
  }
  out.push('</svg>');
  return out.join('');
}

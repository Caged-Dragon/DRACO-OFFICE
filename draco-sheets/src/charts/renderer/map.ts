import { fmtNum, isNum } from '../math';
import { maxOf, minOf } from '../../formulas/safeMath';
import { TABLE, resolveRegion, type MapKind } from '../maps';
import { esc, f1 } from './util';
import type { RenderCtx } from './ctx';

/** map chart renderer. */
export function renderMap(c: RenderCtx): string {
  const { o, fg, mute, gridc, font, out, cats, ser, L, T, pw, ph, empty } = c;
  const kind: MapKind = o.map ?? 'us';
  const vals = new Map<string, number>();
  let miss = 0;
  cats.forEach((c, i) => {
    const r = resolveRegion(kind, c);
    const v = ser[0].values[i];
    if (r && isNum(v)) vals.set(r[0], v);
    else miss++;
  });
  const nums = [...vals.values()];
  if (!nums.length) return empty();
  const lo = minOf(nums),
    hi = maxOf(nums);
  const ramp = ['#DCE9F7', '#B3D0EE', '#86B3E1', '#5B93D2', '#3A73BD', '#1F5299', '#103A73'];
  const colorOf = (v: number) => ramp[Math.min(ramp.length - 1, Math.floor(((v - lo) / (hi - lo || 1)) * ramp.length))];
  const legend = () =>
    ramp.forEach((c, k) => {
      const y = T + ph - (k + 1) * (ph / ramp.length);
      out.push(`<rect x="${f1(L + pw - 16)}" y="${f1(y)}" width="10" height="${f1(ph / ramp.length)}" fill="${c}"/>`);
      if (k % 3 === 0 || k === ramp.length - 1)
        out.push(
          `<text x="${f1(L + pw - 20)}" y="${f1(y + 9)}" text-anchor="end" fill="${mute}" font-size="10">${fmtNum(lo + ((hi - lo) * k) / ramp.length)}</text>`,
        );
    });
  if (kind === 'world') {
    const mw = pw - 40,
      mh = ph,
      X = (lon: number) => L + ((lon + 180) / 360) * mw,
      Y = (lat: number) => T + ((84 - lat) / 148) * mh;
    for (let lon = -180; lon <= 180; lon += 30)
      out.push(`<line x1="${f1(X(lon))}" y1="${f1(T)}" x2="${f1(X(lon))}" y2="${f1(T + mh)}" stroke="${gridc}"/>`);
    for (let lat = -60; lat <= 80; lat += 20)
      out.push(`<line x1="${f1(L)}" y1="${f1(Y(lat))}" x2="${f1(L + mw)}" y2="${f1(Y(lat))}" stroke="${gridc}"/>`);
    TABLE.world.forEach((r) =>
      out.push(`<circle cx="${f1(X(r[2]))}" cy="${f1(Y(r[3]))}" r="2" fill="${mute}" opacity=".5"/>`),
    );
    for (const [code, v] of vals) {
      const r = TABLE.world.find((x) => x[0] === code)!;
      const rad = 4 + Math.sqrt((v - lo) / (hi - lo || 1)) * 14;
      out.push(
        `<circle cx="${f1(X(r[2]))}" cy="${f1(Y(r[3]))}" r="${f1(rad)}" fill="${colorOf(v)}" fill-opacity=".8" stroke="${fg}" stroke-width=".6"><title>${esc(r[1])}: ${fmtNum(v, false)}</title></circle>`,
      );
      if (o.labels && rad > 8)
        out.push(
          `<text x="${f1(X(r[2]))}" y="${f1(Y(r[3]) + 3)}" text-anchor="middle" font-size="8" fill="#fff">${code}</text>`,
        );
    }
  } else {
    const tiles = TABLE[kind];
    const cols = maxOf(tiles.map((r) => r[2])) + 1,
      rows = maxOf(tiles.map((r) => r[3])) + 1;
    const gw = pw - 28;
    const cs = Math.min(gw / cols, ph / rows);
    const ox = L + (gw - cs * cols) / 2,
      oy = T + (ph - cs * rows) / 2;
    for (const r of tiles) {
      const v = vals.get(r[0]);
      out.push(
        `<rect x="${f1(ox + r[2] * cs + 1)}" y="${f1(oy + r[3] * cs + 1)}" width="${f1(cs - 2)}" height="${f1(cs - 2)}" rx="3" fill="${v == null ? gridc : colorOf(v)}"><title>${esc(r[1])}${v == null ? '' : ': ' + fmtNum(v, false)}</title></rect><text x="${f1(ox + r[2] * cs + cs / 2)}" y="${f1(oy + r[3] * cs + cs / 2 + (o.labels && v != null ? -1 : 3))}" text-anchor="middle" font-size="${cs > 30 ? 10 : 8}" font-weight="600" fill="${v == null ? mute : (v - lo) / (hi - lo || 1) > 0.35 ? '#fff' : '#223'}">${r[0]}</text>${o.labels && v != null && cs > 28 ? `<text x="${f1(ox + r[2] * cs + cs / 2)}" y="${f1(oy + r[3] * cs + cs / 2 + 10)}" text-anchor="middle" font-size="8" fill="${(v - lo) / (hi - lo || 1) > 0.35 ? '#fff' : '#223'}">${fmtNum(v)}</text>` : ''}`,
      );
    }
  }
  legend();
  if (miss)
    out.push(
      `<text x="${L + 4}" y="${f1(T + ph - 2)}" fill="${mute}" font-size="9">${miss} label${miss > 1 ? 's' : ''} not matched</text>`,
    );
  out.push('</svg>');
  return out.join('');
}

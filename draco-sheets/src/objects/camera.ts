import { maxOf } from '../safeMath';
// Camera / linked picture (v72): a live, picture-like render of a cell range. Pure SVG.
export interface CamCell { v: string; bold?: boolean; italic?: boolean; color?: string; bg?: string; align?: 'left' | 'center' | 'right' }
export interface CamData { sheet: string; range: string; grid: CamCell[][]; colW?: number[]; rowH?: number; showGrid?: boolean }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const f = (n: number) => (Math.round(n * 100) / 100).toString();
export function renderCamera(d: CamData): { svg: string; w: number; h: number } {
  const rows = d.grid.length, cols = d.grid[0]?.length ?? 0; const rh = d.rowH ?? 22;
  const cw = Array.from({ length: cols }, (_, c) => d.colW?.[c] ?? Math.min(180, Math.max(48, maxOf(d.grid.map((r) => (r[c]?.v ?? '').length)) * 7.2 + 14)));
  const W = Math.max(40, cw.reduce((a, b) => a + b, 0)), H = Math.max(rh, rows * rh); const out: string[] = [];
  let y = 0;
  d.grid.forEach((r) => {
    let x = 0;
    r.forEach((c, ci) => {
      const w = cw[ci];
      if (c.bg) out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${rh}" fill="${c.bg}"/>`);
      if (c.v !== '') {
        const al = c.align ?? (/^[-+$€£]?[\d,]*\.?\d+%?$/.test(c.v.trim()) ? 'right' : 'left'); const tx = al === 'right' ? x + w - 5 : al === 'center' ? x + w / 2 : x + 5; const max = Math.floor(w / 6.2);
        out.push(`<text x="${f(tx)}" y="${f(y + rh / 2 + 4)}" text-anchor="${al === 'right' ? 'end' : al === 'center' ? 'middle' : 'start'}" fill="${c.color ?? '#222'}" font-weight="${c.bold ? 700 : 400}" font-style="${c.italic ? 'italic' : 'normal'}">${esc(c.v.length > max ? c.v.slice(0, Math.max(1, max - 1)) + '…' : c.v)}</text>`);
      }
      x += w;
    });
    y += rh;
  });
  if (d.showGrid !== false) { let x = 0; for (let c = 0; c <= cols; c++) { out.push(`<line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${f(H)}" stroke="#d0d0d0" stroke-width=".7"/>`); x += cw[c] ?? 0; } for (let r = 0; r <= rows; r++) out.push(`<line x1="0" y1="${r * rh}" x2="${f(W)}" y2="${r * rh}" stroke="#d0d0d0" stroke-width=".7"/>`); }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}" font-family="Calibri, Segoe UI, Arial, sans-serif" font-size="12" role="img" aria-label="Linked picture of ${esc(d.range)}"><rect width="${f(W)}" height="${f(H)}" fill="#fff"/>${out.join('')}</svg>`, w: W, h: H };
}

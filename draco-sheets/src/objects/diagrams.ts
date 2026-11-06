// SmartArt-style diagrams (v71): text outline -> SVG layouts. Pure.
import { PALETTES } from '../charts/render';
import { wrapText } from './shapes';
import { maxOf, minOf } from '../safeMath';
export type DiagramKind = 'list' | 'blocks' | 'process' | 'chevrons' | 'cycle' | 'hierarchy' | 'pyramid' | 'matrix' | 'venn' | 'timeline';
export const DIAGRAM_KINDS: Array<[DiagramKind, string]> = [['list', 'Vertical list'], ['blocks', 'Block grid'], ['process', 'Basic process'], ['chevrons', 'Chevron process'], ['cycle', 'Cycle'], ['hierarchy', 'Hierarchy (org chart)'], ['pyramid', 'Pyramid'], ['matrix', 'Matrix (2×2)'], ['venn', 'Venn'], ['timeline', 'Timeline']];
export interface DNode { text: string; level: number; children: DNode[] }
export interface DiagramData { kind: DiagramKind; text: string; palette?: string; theme?: 'light' | 'dark'; fontSize?: number }

/** Outline text -> forest. Level = leading tabs, or every 2 leading spaces; leading "-", "*", "•" bullets are stripped. */
export function parseOutline(text: string): DNode[] {
  const roots: DNode[] = []; const stack: DNode[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue; const m = raw.match(/^([ \t]*)/)!; const ind = m[1].replace(/\t/g, '  ').length; const level = Math.floor(ind / 2);
    const node: DNode = { text: raw.trim().replace(/^[-*•]\s+/, ''), level, children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node); else roots.push(node);
    stack.push(node);
  }
  return roots;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const f = (n: number) => (Math.round(n * 100) / 100).toString();
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

export function renderDiagram(d: DiagramData, W = 460, H = 300): string {
  const pal = PALETTES[d.palette ?? 'office'] ?? PALETTES.office; const dark = d.theme === 'dark'; const bg = dark ? '#1e1e1e' : '#fff'; const fs = d.fontSize ?? 13;
  const roots = parseOutline(d.text); const top = roots.length === 1 && d.kind !== 'hierarchy' && roots[0].children.length ? roots[0].children : roots; const items = top;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="${fs}" role="img" aria-label="${esc(d.kind)} diagram"><rect width="${W}" height="${H}" fill="${bg}"/>`];
  if (!roots.length) { out.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#888">Type some text to build a diagram</text></svg>`); return out.join(''); }
  const color = (i: number) => pal[i % pal.length]; const ink = (c: string) => (luminance(c) > 0.62 ? '#222' : '#fff');
  const label = (t: string, cx: number, cy: number, maxW: number, c: string, size = fs) => { const lines = wrapText(t, Math.max(3, Math.floor(maxW / (size * 0.56)))).slice(0, 4); const lh = size * 1.2; return `<text text-anchor="middle" fill="${ink(c)}" font-size="${size}" font-weight="600">${lines.map((l, i) => `<tspan x="${f(cx)}" y="${f(cy - ((lines.length - 1) * lh) / 2 + i * lh + size * 0.35)}">${esc(l)}</tspan>`).join('')}</text>`; };
  const P = 12; const n = items.length;
  const box = (x: number, y: number, w: number, h: number, i: number, t: string, r = 8) => `<g><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="${color(i)}"/>${label(t, x + w / 2, y + h / 2, w - 12, color(i))}</g>`;
  const arrowCol = dark ? '#aaa' : '#777';
  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    const a = Math.atan2(y2 - y1, x2 - x1); const p = (ang: number) => `${f(x2 + 9 * Math.cos(ang))},${f(y2 + 9 * Math.sin(ang))}`;
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${arrowCol}" stroke-width="2"/><polygon points="${f(x2)},${f(y2)} ${p(a + Math.PI - 0.45)} ${p(a + Math.PI + 0.45)}" fill="${arrowCol}"/>`;
  };
  switch (d.kind) {
    case 'list': { const h = Math.min(54, (H - P * 2 - (n - 1) * 8) / n); items.forEach((it, i) => out.push(box(P, P + i * (h + 8), W - P * 2, h, i, it.text))); break; }
    case 'blocks': { const cols = Math.ceil(Math.sqrt(n * (W / H))); const rows = Math.ceil(n / cols); const w = (W - P * 2 - (cols - 1) * 8) / cols, h = (H - P * 2 - (rows - 1) * 8) / rows; items.forEach((it, i) => out.push(box(P + (i % cols) * (w + 8), P + Math.floor(i / cols) * (h + 8), w, h, i, it.text))); break; }
    case 'process': { const gap = 26; const w = (W - P * 2 - (n - 1) * gap) / n, h = Math.min(90, H - P * 2); items.forEach((it, i) => { const x = P + i * (w + gap), y = (H - h) / 2; out.push(box(x, y, w, h, i, it.text)); if (i < n - 1) out.push(arrow(x + w + 3, H / 2, x + w + gap - 3, H / 2)); }); break; }
    case 'chevrons': { const w = (W - P * 2) / n + 10, h = Math.min(80, H - P * 2); items.forEach((it, i) => { const x = P + i * (w - 10), y = (H - h) / 2, k = 18; out.push(`<g><polygon points="${f(x)},${f(y)} ${f(x + w - k)},${f(y)} ${f(x + w)},${f(y + h / 2)} ${f(x + w - k)},${f(y + h)} ${f(x)},${f(y + h)} ${f(x + k)},${f(y + h / 2)}" fill="${color(i)}" stroke="${bg}" stroke-width="2"/>${label(it.text, x + w / 2 + 2, y + h / 2, w - 44, color(i))}</g>`); }); break; }
    case 'cycle': {
      const R = Math.min(W, H) / 2 - 44; const cx = W / 2, cy = H / 2; const nr = Math.min(36, Math.max(22, R * 0.45));
      const pts = items.map((_, i) => [cx + R * Math.sin((i / n) * Math.PI * 2), cy - R * Math.cos((i / n) * Math.PI * 2)] as const);
      items.forEach((_, i) => { if (n < 2) return; const a = pts[i], b = pts[(i + 1) % n]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); out.push(arrow(a[0] + (nr + 2) * Math.cos(ang), a[1] + (nr + 2) * Math.sin(ang), b[0] - (nr + 4) * Math.cos(ang), b[1] - (nr + 4) * Math.sin(ang))); });
      items.forEach((it, i) => out.push(`<g><circle cx="${f(pts[i][0])}" cy="${f(pts[i][1])}" r="${f(nr)}" fill="${color(i)}"/>${label(it.text, pts[i][0], pts[i][1], nr * 1.7, color(i), Math.min(fs, 12))}</g>`));
      break;
    }
    case 'hierarchy': {
      const depth = (t: DNode): number => 1 + maxOf(t.children.map(depth), [0]); let slot = 0; const pos = new Map<DNode, { x: number; d: number }>();
      const place = (t: DNode, dd: number) => { if (!t.children.length) { pos.set(t, { x: slot++, d: dd }); return; } t.children.forEach((c) => place(c, dd + 1)); const xs = t.children.map((c) => pos.get(c)!.x); pos.set(t, { x: (minOf(xs) + maxOf(xs)) / 2, d: dd }); };
      const virtual: DNode = roots.length === 1 ? roots[0] : { text: '', level: -1, children: roots }; place(virtual, 0);
      const ld = depth(virtual); const nSlots = Math.max(1, slot);
      const bw = Math.min(110, (W - P * 2) / nSlots - 8), bh = Math.min(40, (H - P * 2) / ld - 16);
      const X = (x: number) => P + ((x + 0.5) / nSlots) * (W - P * 2); const Y = (dd: number) => P + dd * ((H - P * 2 - bh) / Math.max(1, ld - 1));
      const shift = roots.length === 1 ? 0 : 1; // virtual root occupies depth 0 but is hidden
      const walk = (t: DNode, ci: number) => {
        const p = pos.get(t)!;
        t.children.forEach((c) => { const q = pos.get(c)!; if (t === virtual && roots.length !== 1) return; out.push(`<path d="M${f(X(p.x))} ${f(Y(p.d) + bh)}V${f((Y(p.d) + bh + Y(q.d)) / 2)}H${f(X(q.x))}V${f(Y(q.d))}" fill="none" stroke="${dark ? '#888' : '#999'}" stroke-width="1.5"/>`); });
        if (t !== virtual || roots.length === 1) out.push(box(X(p.x) - bw / 2, Y(p.d), bw, bh, p.d + ci, t.text, 6));
        t.children.forEach((c, j) => walk(c, ci + (p.d === 0 ? j : 0)));
      };
      void shift; walk(virtual, 0); break;
    }
    case 'pyramid': { const h = (H - P * 2) / n; items.forEach((it, i) => { const y = P + i * h; const half = (W - P * 2) / 2; const wTop = (i / n) * half, wBot = ((i + 1) / n) * half; out.push(`<g><polygon points="${f(W / 2 - wTop)},${f(y)} ${f(W / 2 + wTop)},${f(y)} ${f(W / 2 + wBot)},${f(y + h)} ${f(W / 2 - wBot)},${f(y + h)}" fill="${color(i)}" stroke="${bg}" stroke-width="2"/>${label(it.text, W / 2, y + h / 2, (wTop + wBot) * 1.5, color(i))}</g>`); }); break; }
    case 'matrix': { const q = items.slice(0, 4); const w = (W - P * 2 - 8) / 2, h = (H - P * 2 - 8) / 2; q.forEach((it, i) => out.push(box(P + (i % 2) * (w + 8), P + Math.floor(i / 2) * (h + 8), w, h, i, it.text))); break; }
    case 'venn': {
      const c = items.slice(0, 3); const r = Math.min(W, H) * (c.length === 2 ? 0.3 : 0.27);
      const centers = c.length === 2 ? [[W / 2 - r * 0.6, H / 2], [W / 2 + r * 0.6, H / 2]] : [[W / 2 - r * 0.6, H / 2 - r * 0.35], [W / 2 + r * 0.6, H / 2 - r * 0.35], [W / 2, H / 2 + r * 0.6]];
      c.forEach((_, i) => out.push(`<circle cx="${f(centers[i][0])}" cy="${f(centers[i][1])}" r="${f(r)}" fill="${color(i)}" fill-opacity=".55" stroke="${color(i)}" stroke-width="2"/>`));
      c.forEach((it, i) => { const dx = centers[i][0] - W / 2, dy = centers[i][1] - H / 2 + (c.length === 3 ? 0.35 * r : 0); out.push(`<text x="${f(centers[i][0] + dx * 0.45)}" y="${f(centers[i][1] + dy * 0.45 + 4)}" text-anchor="middle" font-weight="600" fill="${dark ? '#fff' : '#222'}">${esc(it.text.length > 14 ? it.text.slice(0, 13) + '…' : it.text)}</text>`); });
      break;
    }
    case 'timeline': {
      const y = H / 2; out.push(`<line x1="${P}" y1="${y}" x2="${W - P}" y2="${y}" stroke="${arrowCol}" stroke-width="3"/>`);
      items.forEach((it, i) => { const x = P + 20 + (n === 1 ? (W - P * 2 - 40) / 2 : (i / (n - 1)) * (W - P * 2 - 40)); const up = i % 2 === 0; out.push(`<circle cx="${f(x)}" cy="${y}" r="7" fill="${color(i)}" stroke="${bg}" stroke-width="2"/><line x1="${f(x)}" y1="${y}" x2="${f(x)}" y2="${f(up ? y - 38 : y + 38)}" stroke="${color(i)}" stroke-width="2"/>`); const bw = Math.min(120, ((W - P * 2) / Math.max(2, n)) * 1.9); out.push(box(Math.min(W - bw - 4, Math.max(4, x - bw / 2)), up ? y - 76 : y + 38, bw, 38, i, it.text, 6)); });
      break;
    }
  }
  out.push('</svg>'); return out.join('');
}

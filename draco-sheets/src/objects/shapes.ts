// Shapes, text boxes and icons (v70). Pure SVG.
export type ShapeKind =
  | 'rect'
  | 'round'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUp'
  | 'arrowDown'
  | 'callout'
  | 'line'
  | 'text'
  | 'icon';
export interface ShapeData {
  kind: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  color?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  icon?: string;
  opacity?: number;
  dashed?: boolean;
  shadow?: boolean;
}
export const SHAPE_LABELS: Array<[ShapeKind, string]> = [
  ['rect', 'Rectangle'],
  ['round', 'Rounded rectangle'],
  ['ellipse', 'Oval'],
  ['triangle', 'Triangle'],
  ['diamond', 'Diamond'],
  ['pentagon', 'Pentagon'],
  ['hexagon', 'Hexagon'],
  ['star', 'Star'],
  ['arrowRight', 'Arrow right'],
  ['arrowLeft', 'Arrow left'],
  ['arrowUp', 'Arrow up'],
  ['arrowDown', 'Arrow down'],
  ['callout', 'Callout'],
  ['line', 'Line'],
  ['text', 'Text box'],
];
/** 24x24 icon paths (original, simple geometry). */
export const ICONS: Record<string, string> = {
  check: 'M4 12l5 5L20 6',
  cross: 'M5 5l14 14M19 5L5 19',
  plus: 'M12 4v16M4 12h16',
  minus: 'M4 12h16',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  cog: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  search: 'M10 17a7 7 0 100-14 7 7 0 000 14zM15 15l6 6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  warning: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.5',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6z',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  bell: 'M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  tag: 'M3 12V3h9l9 9-9 9z',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14',
  pin: 'M12 22s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 12a2 2 0 100-4 2 2 0 000 4z',
  thumbUp: 'M7 11v10H3V11zM7 11l4-8c2 0 3 1 3 3v3h6l-2 9H7',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
};
const f = (n: number) => (Math.round(n * 100) / 100).toString();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const poly = (pts: Array<[number, number]>) => pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
/** Wrap text to a max number of chars per line (greedy). */
export function wrapText(t: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of t.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      if ((line + ' ' + w).trim().length > maxChars && line) {
        out.push(line);
        line = w;
      } else line = (line + ' ' + w).trim();
    }
    out.push(line);
  }
  return out;
}

export function renderShape(d: ShapeData, W = 160, H = 100): string {
  const sw = d.strokeWidth ?? (d.kind === 'text' ? 0 : 2);
  const fill = d.kind === 'text' || d.kind === 'line' ? 'none' : (d.fill ?? '#4472C4');
  const stroke = d.stroke ?? (d.kind === 'text' ? 'none' : '#2F528F');
  const m = sw / 2 + 1;
  const x0 = m,
    y0 = m,
    x1 = W - m,
    y1 = H - m,
    cx = W / 2,
    cy = H / 2;
  const w = x1 - x0,
    h = y1 - y0;
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${d.dashed ? ' stroke-dasharray="6 4"' : ''} stroke-linejoin="round" opacity="${d.opacity ?? 1}"`;
  let body = '';
  switch (d.kind) {
    case 'rect':
    case 'text':
      body = `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" ${attrs}/>`;
      break;
    case 'round':
      body = `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(w, h) * 0.18)}" ${attrs}/>`;
      break;
    case 'ellipse':
      body = `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w / 2)}" ry="${f(h / 2)}" ${attrs}/>`;
      break;
    case 'triangle':
      body = `<polygon points="${poly([
        [cx, y0],
        [x1, y1],
        [x0, y1],
      ])}" ${attrs}/>`;
      break;
    case 'diamond':
      body = `<polygon points="${poly([
        [cx, y0],
        [x1, cy],
        [cx, y1],
        [x0, cy],
      ])}" ${attrs}/>`;
      break;
    case 'pentagon':
      body = `<polygon points="${poly(Array.from({ length: 5 }, (_, i) => [cx + (w / 2) * Math.sin((i * 2 * Math.PI) / 5), cy - (h / 2) * Math.cos((i * 2 * Math.PI) / 5)] as [number, number]))}" ${attrs}/>`;
      break;
    case 'hexagon':
      body = `<polygon points="${poly(Array.from({ length: 6 }, (_, i) => [cx + (w / 2) * Math.cos((i * Math.PI) / 3), cy + (h / 2) * Math.sin((i * Math.PI) / 3)] as [number, number]))}" ${attrs}/>`;
      break;
    case 'star':
      body = `<polygon points="${poly(
        Array.from({ length: 10 }, (_, i) => {
          const r = i % 2 ? 0.42 : 1;
          return [cx + (w / 2) * r * Math.sin((i * Math.PI) / 5), cy - (h / 2) * r * Math.cos((i * Math.PI) / 5)] as [
            number,
            number,
          ];
        }),
      )}" ${attrs}/>`;
      break;
    case 'arrowRight':
      body = `<polygon points="${poly([
        [x0, cy - h * 0.2],
        [x0 + w * 0.6, cy - h * 0.2],
        [x0 + w * 0.6, y0],
        [x1, cy],
        [x0 + w * 0.6, y1],
        [x0 + w * 0.6, cy + h * 0.2],
        [x0, cy + h * 0.2],
      ])}" ${attrs}/>`;
      break;
    case 'arrowLeft':
      body = `<polygon points="${poly([
        [x1, cy - h * 0.2],
        [x1 - w * 0.6, cy - h * 0.2],
        [x1 - w * 0.6, y0],
        [x0, cy],
        [x1 - w * 0.6, y1],
        [x1 - w * 0.6, cy + h * 0.2],
        [x1, cy + h * 0.2],
      ])}" ${attrs}/>`;
      break;
    case 'arrowUp':
      body = `<polygon points="${poly([
        [cx - w * 0.2, y1],
        [cx - w * 0.2, y0 + h * 0.4],
        [x0, y0 + h * 0.4],
        [cx, y0],
        [x1, y0 + h * 0.4],
        [cx + w * 0.2, y0 + h * 0.4],
        [cx + w * 0.2, y1],
      ])}" ${attrs}/>`;
      break;
    case 'arrowDown':
      body = `<polygon points="${poly([
        [cx - w * 0.2, y0],
        [cx - w * 0.2, y1 - h * 0.4],
        [x0, y1 - h * 0.4],
        [cx, y1],
        [x1, y1 - h * 0.4],
        [cx + w * 0.2, y1 - h * 0.4],
        [cx + w * 0.2, y0],
      ])}" ${attrs}/>`;
      break;
    case 'callout':
      body = `<path d="M${f(x0)} ${f(y0)}H${f(x1)}V${f(y0 + h * 0.72)}H${f(x0 + w * 0.35)}L${f(x0 + w * 0.15)} ${f(y1)}L${f(x0 + w * 0.2)} ${f(y0 + h * 0.72)}H${f(x0)}Z" ${attrs}/>`;
      break;
    case 'line':
      body = `<line x1="${f(x0)}" y1="${f(y1)}" x2="${f(x1)}" y2="${f(y0)}" stroke="${d.stroke ?? '#2F528F'}" stroke-width="${sw}"${d.dashed ? ' stroke-dasharray="6 4"' : ''} stroke-linecap="round"/>`;
      break;
    case 'icon': {
      const path = ICONS[d.icon ?? 'star'] ?? ICONS.star;
      const s = Math.min(W, H);
      body = `<g transform="translate(${f((W - s) / 2)} ${f((H - s) / 2)}) scale(${f(s / 24)})"><path d="${path}" fill="${d.fill ?? 'none'}" stroke="${d.stroke ?? d.color ?? '#333'}" stroke-width="${(d.strokeWidth ?? 1.8) * (d.fill ? 1 : 1)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      break;
    }
  }
  const txt =
    d.kind === 'icon' || d.kind === 'line'
      ? ''
      : d.text
        ? (() => {
            const fs = d.size ?? 14;
            const lines = wrapText(d.text, Math.max(3, Math.floor(w / (fs * 0.55))));
            const lh = fs * 1.25;
            const startY = d.kind === 'text' ? y0 + fs : cy - ((lines.length - 1) * lh) / 2 + fs * 0.35;
            const ax = d.align === 'left' ? x0 + 6 : d.align === 'right' ? x1 - 6 : cx;
            const anchor = d.align === 'left' ? 'start' : d.align === 'right' ? 'end' : 'middle';
            return `<text text-anchor="${anchor}" font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="${fs}" font-weight="${d.bold ? 700 : 400}" font-style="${d.italic ? 'italic' : 'normal'}" fill="${d.color ?? (d.kind === 'text' ? '#222' : '#fff')}">${lines.map((l, i) => `<tspan x="${f(ax)}" y="${f(startY + i * lh)}">${esc(l)}</tspan>`).join('')}</text>`;
          })()
        : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"${d.shadow ? ' style="filter:drop-shadow(2px 3px 3px rgba(0,0,0,.35))"' : ''} role="img" aria-label="${esc(d.text ?? d.icon ?? d.kind)}">${body}${txt}</svg>`;
}

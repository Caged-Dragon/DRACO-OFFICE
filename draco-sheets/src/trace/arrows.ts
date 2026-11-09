// Trace precedents / dependents arrows (v1.1.0): pure edge builder + SVG geometry. No DOM, no engine.
import { extractRefs, extractNameRefs, rectHas, type FormulaCell, type Rect } from '../formulas/audit';
export interface Cell {
  sheet: string;
  row: number;
  col: number;
}
export interface Edge {
  from: Rect;
  to: Cell;
}
const key = (c: Cell) => `${c.sheet}|${c.row}|${c.col}`;
const refsOf = (f: FormulaCell, names: Record<string, string>) =>
  [...extractRefs(f.formula, f.sheet), ...extractNameRefs(f.formula, f.sheet, names)].map((r) => ({
    ...r,
    sheet: r.sheet ?? f.sheet,
  }));
/** Arrows pointing INTO `cell` from everything its formula reads (and, when deep, what those read). */
export function precedentEdges(
  cell: Cell,
  formulas: FormulaCell[],
  names: Record<string, string>,
  deep: boolean,
  limit = 200,
): Edge[] {
  const by = new Map(formulas.map((f) => [key(f), f]));
  const out: Edge[] = [];
  const seen = new Set<string>();
  const done = new Set<string>();
  let frontier: FormulaCell[] = by.has(key(cell)) ? [by.get(key(cell))!] : [];
  while (frontier.length && out.length < limit) {
    const next: FormulaCell[] = [];
    for (const f of frontier) {
      if (done.has(key(f))) continue;
      done.add(key(f));
      for (const r of refsOf(f, names)) {
        const k = `${r.sheet}|${r.r1}|${r.c1}|${r.r2}|${r.c2}>${key(f)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ from: r, to: { sheet: f.sheet, row: f.row, col: f.col } });
        if (deep) for (const g of formulas) if (rectHas(r, g.sheet, g.row, g.col)) next.push(g);
      }
    }
    if (!deep) break;
    frontier = next;
  }
  return out.slice(0, limit);
}
/** Arrows pointing OUT of `cell` to every formula that reads it (transitively when deep). */
export function dependentEdges(
  cell: Cell,
  formulas: FormulaCell[],
  names: Record<string, string>,
  deep: boolean,
  limit = 200,
): Edge[] {
  const out: Edge[] = [];
  const done = new Set<string>();
  let targets: Cell[] = [cell];
  const refs = new Map(formulas.map((f) => [key(f), refsOf(f, names)]));
  while (targets.length && out.length < limit) {
    const next: Cell[] = [];
    for (const t of targets) {
      if (done.has(key(t))) continue;
      done.add(key(t));
      for (const g of formulas)
        if (refs.get(key(g))!.some((r) => rectHas(r, t.sheet, t.row, t.col))) {
          out.push({
            from: { sheet: t.sheet, r1: t.row, c1: t.col, r2: t.row, c2: t.col },
            to: { sheet: g.sheet, row: g.row, col: g.col },
          });
          next.push({ sheet: g.sheet, row: g.row, col: g.col });
        }
    }
    if (!deep) break;
    targets = next;
  }
  return out.slice(0, limit);
}
export interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Build SVG markup for edges on `sheet`. `geo(row,col)` gives a cell's pixel box in sheet coordinates. Returns markup (relative to bbox) + bbox. */
export function arrowSvg(
  edges: Edge[],
  sheet: string,
  geo: (r: number, c: number) => Geo,
  color = '#2563eb',
  pad = 8,
): { svg: string; left: number; top: number; width: number; height: number; drawn: number; otherSheet: number } {
  const on = edges.filter((e) => e.to.sheet === sheet && e.from.sheet === sheet);
  const otherSheet = edges.filter(
    (e) => (e.to.sheet === sheet) !== (e.from.sheet === sheet) || (e.to.sheet !== sheet && e.from.sheet !== sheet),
  ).length;
  type P = { x: number; y: number };
  const items = on.map((e) => {
    const a = geo(e.from.r1, e.from.c1),
      b = geo(e.from.r2, e.from.c2),
      t = geo(e.to.row, e.to.col);
    const single = e.from.r1 === e.from.r2 && e.from.c1 === e.from.c2;
    const box = { x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y };
    return { e, box, t, single };
  });
  if (!items.length) return { svg: '', left: 0, top: 0, width: 0, height: 0, drawn: 0, otherSheet };
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const i of items)
    for (const r of [i.box, i.t]) {
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
  const L = x0 - pad,
    T = y0 - pad,
    W = x1 - x0 + pad * 2,
    H = y1 - y0 + pad * 2;
  const f = (n: number) => Math.round(n * 10) / 10;
  const out: string[] = [];
  out.push(
    `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${color}"/></marker></defs>`,
  );
  for (const i of items) {
    const tc: P = { x: i.t.x + i.t.w / 2 - L, y: i.t.y + i.t.h / 2 - T };
    const bc: P = { x: i.box.x + i.box.w / 2 - L, y: i.box.y + i.box.h / 2 - T };
    if (!i.single)
      out.push(
        `<rect x="${f(i.box.x - L)}" y="${f(i.box.y - T)}" width="${f(i.box.w)}" height="${f(i.box.h)}" fill="none" stroke="${color}" stroke-dasharray="4 3" stroke-width="1.5"/>`,
      );
    // self-reference: small loop instead of a zero-length line
    if (i.e.to.row === i.e.from.r1 && i.e.to.col === i.e.from.c1 && i.single) {
      out.push(
        `<path d="M${f(tc.x + 6)},${f(tc.y - 6)} a8,8 0 1,1 -2,-2" fill="none" stroke="${color}" stroke-width="1.5" marker-end="url(#ah)"/>`,
      );
      continue;
    }
    // end the line at the border of the target cell so the arrowhead is visible
    const dx = tc.x - bc.x,
      dy = tc.y - bc.y,
      len = Math.hypot(dx, dy) || 1;
    const k = Math.min((i.t.w / 2 + 2) / (Math.abs(dx / len) || 1e-9), (i.t.h / 2 + 2) / (Math.abs(dy / len) || 1e-9));
    const ex = tc.x - (dx / len) * Math.min(k, len),
      ey = tc.y - (dy / len) * Math.min(k, len);
    const sx = i.single ? bc.x : bc.x,
      sy = i.single ? bc.y : bc.y;
    out.push(
      `<circle cx="${f(sx)}" cy="${f(sy)}" r="3" fill="${color}"/><line x1="${f(sx)}" y1="${f(sy)}" x2="${f(ex)}" y2="${f(ey)}" stroke="${color}" stroke-width="1.5" marker-end="url(#ah)"/>`,
    );
  }
  return { svg: out.join(''), left: L, top: T, width: W, height: H, drawn: items.length, otherSheet };
}

/** Rewrite dynamic-array spill references: `A1#` → an OFFSET over the contiguous non-blank block starting at A1. */
export function rewriteSpillRefs(formula: string, maxRows = 10000, maxCols = 100): string {
  if (!formula.includes('#')) return formula;
  const parts = formula.split(/("(?:[^"]|"")*")/); // keep string literals intact
  return parts
    .map((seg, i) =>
      i % 2
        ? seg
        : seg.replace(
            /((?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d+)#/g,
            (_m, sh: string | undefined, _d1: string, col: string, _d2: string, row: string) => {
              const s = sh ?? '';
              const a = `${s}${col}${row}`;
              const colRef = `${s}${col}:${col}`;
              const rowRef = `${s}${row}:${row}`;
              const rows = `IFERROR(MATCH(TRUE,INDEX(ISBLANK(${a}:INDEX(${colRef},MIN(ROWS(${colRef}),ROW(${a})+${maxRows - 1}))),0),0)-1,MIN(ROWS(${colRef})-ROW(${a})+1,${maxRows}))`;
              const cols = `IFERROR(MATCH(TRUE,INDEX(ISBLANK(${a}:INDEX(${rowRef},MIN(COLUMNS(${rowRef}),COLUMN(${a})+${maxCols - 1}))),0),0)-1,MIN(COLUMNS(${rowRef})-COLUMN(${a})+1,${maxCols}))`;
              return `OFFSET(${a},0,0,${rows},${cols})`;
            },
          ),
    )
    .join('');
}

/** Red ellipses around cells (Circle Invalid Data). `geo(row,col)` is the cell's pixel box in sheet coordinates. */
export function circleSvg(
  cells: Array<{ row: number; col: number }>,
  geo: (r: number, c: number) => Geo,
  color = '#dc2626',
  pad = 4,
): { svg: string; left: number; top: number; width: number; height: number; drawn: number } {
  if (!cells.length) return { svg: '', left: 0, top: 0, width: 0, height: 0, drawn: 0 };
  const g = cells.map((c) => geo(c.row, c.col));
  const x0 = Math.min(...g.map((r) => r.x)) - pad,
    y0 = Math.min(...g.map((r) => r.y)) - pad,
    x1 = Math.max(...g.map((r) => r.x + r.w)) + pad,
    y1 = Math.max(...g.map((r) => r.y + r.h)) + pad;
  const f = (n: number) => Math.round(n * 10) / 10;
  return {
    svg: g
      .map(
        (r) =>
          `<ellipse cx="${f(r.x + r.w / 2 - x0)}" cy="${f(r.y + r.h / 2 - y0)}" rx="${f(r.w / 2 + 2)}" ry="${f(r.h / 2 + 2)}" fill="none" stroke="${color}" stroke-width="2"/>`,
      )
      .join(''),
    left: x0,
    top: y0,
    width: x1 - x0,
    height: y1 - y0,
    drawn: cells.length,
  };
}

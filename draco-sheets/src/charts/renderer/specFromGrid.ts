import type { ChartSpec, ChartType, Series } from './types';

/** Ready-made chart from a rectangular block. Header row detected when any non-first cell is text; first column is categories when it is text (or x-values for scatter/bubble). */
export function specFromGrid(grid: Array<Array<string | number | null>>, type: ChartType, title = ''): ChartSpec {
  const num = (v: unknown): number | null =>
    typeof v === 'number'
      ? v
      : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v.replace(/[,$%\s]/g, ''))
        ? +v.replace(/[,$%\s]/g, '')
        : null;
  const cols = grid[0]?.length ?? 0;
  if (!grid.length || !cols) return { type, title, categories: [], series: [], opts: {} };
  const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '' && num(v) == null;
  const hasHeader =
    (grid.length > 1 && grid[0].some((v, i) => i > 0 && isText(v))) ||
    (grid.length > 1 && cols === 1 && isText(grid[0][0]));
  const body = hasHeader ? grid.slice(1) : grid;
  const head = hasHeader ? grid[0] : grid[0].map((_, i) => `Series ${i + 1}`);
  const xy = type === 'scatter' || type === 'bubble';
  const textCol0 = cols > 1 && body.some((r) => isText(r[0]));
  const firstIsX = xy && cols > 1;
  const firstIsCat = !xy && textCol0;
  const start = firstIsX || firstIsCat ? 1 : 0;
  const categories = firstIsCat ? body.map((r) => String(r[0] ?? '')) : xy ? [] : body.map((_, i) => String(i + 1));
  const dataCols = Array.from({ length: cols - start }, (_, i) => i + start);
  let series: Series[];
  if (xy) {
    const xsv = body.map((r, i) => (firstIsX ? (num(r[0]) ?? i + 1) : i + 1));
    const yc = type === 'bubble' ? dataCols.slice(0, 1) : dataCols;
    series = yc.map((c) => ({
      name: String(head[c] ?? `Series ${c + 1}`),
      values: body.map((r) => num(r[c])),
      xs: xsv,
      sizes: type === 'bubble' ? body.map((r) => num(r[c + 1]) ?? 1) : undefined,
    }));
  } else
    series = dataCols.map((c) => ({ name: String(head[c] ?? `Series ${c + 1}`), values: body.map((r) => num(r[c])) }));
  return { type, title, categories, series, opts: {} };
}

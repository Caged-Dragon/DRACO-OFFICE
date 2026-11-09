// Engine glue for charts (v61-v68): create from a range, keep in sync with source data, edit, delete.
import type { Engine } from '../core/engine';
import { parseRef, selectionLoc, targetLoc, readValues, type Out } from '../data/dataGlue';
import { a1, numToCol } from '../formulas/audit';
import { specFromGrid, type ChartOpts, type ChartSpec, type ChartType, type Series } from './render';

import { ALL_KEYS, CHART_KEY } from '../objects/keys';
export { CHART_KEY };
export interface ChartData {
  spec: ChartSpec;
  sheet: string;
  range: string;
  type: ChartType;
  title: string;
  byRows: boolean;
  opts: ChartOpts;
  over?: Array<Partial<Pick<Series, 'kind' | 'secondary' | 'color' | 'name'>>>;
}
export interface ChartInfo {
  id: string;
  sheet: string;
  range: string;
  type: ChartType;
  title: string;
  w: number;
  h: number;
}
type Grid = Array<Array<string | number | null>>;
const transpose = (g: Grid): Grid => (g[0] ?? []).map((_, c) => g.map((r) => r[c] ?? null));
const ok = (message: string): Out => ({ ok: true, message });
const fail = (message: string): Out => ({ ok: false, message });

/** Pure: build the renderable spec from a data grid + the chart's saved settings. */
export function buildSpec(d: Pick<ChartData, 'type' | 'title' | 'byRows' | 'opts' | 'over'>, grid: Grid): ChartSpec {
  const g = d.byRows ? transpose(grid) : grid;
  const spec = specFromGrid(g, d.type, d.title);
  spec.opts = { ...d.opts };
  if (d.type === 'combo' && spec.series.length >= 1 && !d.over?.some((o) => o.kind))
    spec.series.forEach((s, i) => {
      if (i === spec.series.length - 1 && spec.series.length > 1) {
        s.kind = 'line';
        s.secondary = true;
      } else s.kind = 'column';
    });
  d.over?.forEach((o, i) => {
    const s = spec.series[i];
    if (s) Object.assign(s, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')));
  });
  return spec;
}

export type WS = ReturnType<NonNullable<ReturnType<Engine['api']['getActiveWorkbook']>>['getActiveSheet']>;
/** Runtime float-doms have no backing drawing, so the engine's updateFloatDom can't edit them: swap in place under the same id. */
export function replaceFloat(
  ws: WS,
  id: string,
  key: string,
  data: unknown,
  pos: { left?: number; top?: number; width?: number; height?: number },
): boolean {
  ws.removeFloatDom(id);
  const left = pos.left ?? 0,
    top = pos.top ?? 0,
    w = pos.width ?? 480,
    h = pos.height ?? 300;
  return !!ws.addFloatDomToPosition(
    {
      componentKey: key,
      data: data as never,
      allowTransform: true,
      initPosition: { startX: left, startY: top, endX: left + w, endY: top + h },
    },
    id,
  );
}
/** Pixel origin of a cell inside the sheet canvas (row header 46px, column header 20px in the engine's default layout). */
export function cellOrigin(ws: WS, r: number, c: number): { left: number; top: number } {
  let left = 46,
    top = 20;
  for (let i = 0; i < c; i++) left += ws.getColumnWidth(i);
  for (let i = 0; i < r; i++) top += ws.getRowHeight(i);
  return { left, top };
}
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
const qsheet = (n: string) => (/^[A-Za-z0-9_]+$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);

export function listCharts(e: Engine): ChartInfo[] {
  const wb = wbOf(e);
  if (!wb) return [];
  const out: ChartInfo[] = [];
  for (const ws of wb.getSheets())
    for (const f of ws.getAllFloatDoms()) {
      if (f?.componentKey !== CHART_KEY) continue;
      const d = f.data as unknown as ChartData | undefined;
      if (!d) continue;
      out.push({
        id: f.id,
        sheet: ws.getSheetName(),
        range: d.range,
        type: d.type,
        title: d.title,
        w: Math.round(f.position.width ?? 0),
        h: Math.round(f.position.height ?? 0),
      });
    }
  return out;
}
function find(e: Engine, id: string) {
  const wb = wbOf(e);
  if (!wb) return null;
  for (const ws of wb.getSheets()) {
    const f = ws.getFloatDomById(id);
    if (f?.componentKey === CHART_KEY) return { ws, f, d: f.data as unknown as ChartData };
  }
  return null;
}
const readGrid = (e: Engine, sheet: string, range: string): Grid | null => {
  const l = parseRef(e, `${qsheet(sheet)}!${range}`);
  return l ? (readValues(l) as Grid) : null;
};

export function chartDefault(e: Engine): { range: string; sheet: string } | null {
  const l = targetLoc(e);
  if (!l) return null;
  return { sheet: l.sheet.getSheetName(), range: `${a1(l.r0, l.c0)}:${a1(l.r0 + l.rows - 1, l.c0 + l.cols - 1)}` };
}

export function createChart(
  e: Engine,
  o: { range?: string; type: ChartType; title?: string; byRows?: boolean; opts?: ChartOpts; w?: number; h?: number },
): Out & { id?: string } {
  const wb = wbOf(e);
  if (!wb) return fail('No workbook open');
  const loc = o.range ? parseRef(e, o.range) : targetLoc(e);
  if (!loc) return fail(`Range isn't valid: "${o.range ?? ''}"`);
  const grid = readValues(loc) as Grid;
  if (!grid.length || grid.every((r) => r.every((v) => v == null || v === '')))
    return fail('Select a range that contains data first.');
  const sheetName = loc.sheet.getSheetName();
  const range = `${a1(loc.r0, loc.c0)}:${a1(loc.r0 + loc.rows - 1, loc.c0 + loc.cols - 1)}`;
  const data: ChartData = {
    spec: undefined as never,
    sheet: sheetName,
    range,
    type: o.type,
    title: o.title ?? '',
    byRows: !!o.byRows,
    opts: { legend: 'bottom', grid: true, ...(o.opts ?? {}) },
  };
  data.spec = buildSpec(data, grid);
  if (!data.spec.series.length || data.spec.series.every((x) => x.values.every((v) => v == null)))
    return fail('No numeric data found in that range.');
  const ws = loc.sheet;
  const existing = ws.getAllFloatDoms().filter((f) => f?.componentKey === CHART_KEY).length;
  const anchor = ws.getRange(loc.r0, Math.min(loc.c0 + loc.cols + 1, 15000), 1, 1);
  const id = `chart-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const res = ws.addFloatDomToRange(
    anchor,
    { componentKey: CHART_KEY, data: data as never, allowTransform: true },
    { width: o.w ?? 480, height: o.h ?? 300, marginX: 6 + (existing % 6) * 26, marginY: 6 + (existing % 6) * 26 },
    id,
  );
  if (!res) return fail('The engine could not place the chart here.');
  return { ...ok(`Chart added to ${sheetName} (${numToCol(loc.c0 + loc.cols + 1)}${loc.r0 + 1})`), id };
}

export const pivotHook: { spec?: (pivotId: string, type: ChartType) => ChartSpec | null } = {};
export function updateChart(
  e: Engine,
  id: string,
  patch: Partial<Pick<ChartData, 'type' | 'title' | 'byRows' | 'range' | 'over'>> & {
    opts?: ChartOpts;
    w?: number;
    h?: number;
    at?: string;
  },
): Out {
  const hit = find(e, id);
  if (!hit) return fail('Chart not found');
  const d: ChartData = {
    ...hit.d,
    ...(patch.type ? { type: patch.type } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.byRows !== undefined ? { byRows: patch.byRows } : {}),
    ...(patch.range ? { range: patch.range.replace(/\$/g, '').toUpperCase() } : {}),
    ...(patch.over ? { over: patch.over } : {}),
    opts: { ...hit.d.opts, ...(patch.opts ?? {}) },
  };
  const pid = (hit.d as unknown as { pivotId?: string }).pivotId;
  if (pid) {
    const sp = pivotHook.spec?.(pid, d.type);
    if (!sp) return fail('The source PivotTable is not available');
    sp.title = d.title;
    sp.opts = { ...sp.opts, ...d.opts };
    d.spec = sp;
  } else {
    const grid = readGrid(e, d.sheet, d.range);
    if (!grid) return fail(`Range isn't valid: "${d.range}"`);
    d.spec = buildSpec(d, grid);
  }
  let pos = { ...hit.f.position, ...(patch.w ? { width: patch.w } : {}), ...(patch.h ? { height: patch.h } : {}) };
  if (patch.at) {
    const l = parseRef(e, patch.at);
    if (!l) return fail(`Cell isn't valid: "${patch.at}"`);
    pos = { ...pos, ...cellOrigin(l.sheet, l.r0, l.c0) };
  }
  return replaceFloat(hit.ws, id, CHART_KEY, d, pos)
    ? ok('Chart updated')
    : fail('The engine could not update the chart');
}
export function removeChart(e: Engine, id: string): Out {
  const hit = find(e, id);
  if (!hit) return fail('Chart not found');
  hit.ws.removeFloatDom(id);
  return ok('Chart deleted');
}

/** Re-read every chart's source range; push new data only if it changed (guards against mutation loops). */
export function refreshCharts(e: Engine): number {
  const wb = wbOf(e);
  if (!wb) return 0;
  let n = 0;
  for (const ws of wb.getSheets())
    for (const f of ws.getAllFloatDoms()) {
      if (f?.componentKey !== CHART_KEY) continue;
      const d = f.data as unknown as ChartData | undefined;
      if (!d?.range) continue;
      const grid = readGrid(e, d.sheet, d.range);
      if (!grid) continue;
      const spec = buildSpec(d, grid);
      if (
        JSON.stringify(spec) !== JSON.stringify(d.spec) &&
        replaceFloat(ws, f.id, CHART_KEY, { ...d, spec }, f.position)
      )
        n++;
    }
  return n;
}
export { selectionLoc };

/* ---- persistence: float-doms created at runtime are not stored by the engine, so charts ride along in the snapshot as a Draco resource ---- */
export const OBJECTS_RESOURCE = 'DRACO_OBJECTS';
export interface SavedObject {
  id: string;
  key?: string;
  sheet: string;
  left: number;
  top: number;
  width: number;
  height: number;
  data: unknown;
}
export function exportObjects(e: Engine): SavedObject[] {
  const wb = wbOf(e);
  if (!wb) return [];
  const out: SavedObject[] = [];
  for (const ws of wb.getSheets())
    for (const f of ws.getAllFloatDoms())
      if (f && (ALL_KEYS as readonly string[]).includes(f.componentKey) && f.data)
        out.push({
          id: f.id,
          key: f.componentKey,
          sheet: ws.getSheetName(),
          left: f.position.left ?? 0,
          top: f.position.top ?? 0,
          width: f.position.width ?? 480,
          height: f.position.height ?? 300,
          data: f.data,
        });
  return out;
}
export function restoreObjects(e: Engine, list: SavedObject[]): number {
  const wb = wbOf(e);
  if (!wb) return 0;
  let n = 0;
  for (const o of list) {
    const ws = wb.getSheetByName(o.sheet);
    if (!ws || ws.getFloatDomById(o.id)) continue;
    const r = ws.addFloatDomToPosition(
      {
        componentKey: o.key ?? CHART_KEY,
        data: o.data as never,
        allowTransform: true,
        initPosition: { startX: o.left, startY: o.top, endX: o.left + o.width, endY: o.top + o.height },
      },
      o.id,
    );
    if (r) n++;
  }
  return n;
}

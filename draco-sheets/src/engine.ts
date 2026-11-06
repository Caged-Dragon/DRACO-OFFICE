import { createUniver, LocaleType, mergeLocales, CommandType } from '@univerjs/presets';
import type { FUniver } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import sheetsCFEnUS from '@univerjs/preset-sheets-conditional-formatting/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import sheetsDVEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import sheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import sheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import sheetsFindEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import sheetsLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import sheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import sheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
import '@univerjs/preset-sheets-sort/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';
import '@univerjs/preset-sheets-hyper-link/lib/index.css';
import '@univerjs/preset-sheets-note/lib/index.css';
import '@univerjs/preset-sheets-drawing/lib/index.css';

export type RibbonMode = 'classic' | 'simple' | 'collapsed';

export function ribbonForWidth(w: number): RibbonMode {
  if (w >= 1100) return 'classic';
  if (w >= 700) return 'simple';
  return 'collapsed';
}

import { ChartView } from './charts/ChartView';
import { SparkView, ShapeView, DiagramView, CameraView, SlicerView, TimelineView, PivotBtnView } from './objects/ObjectViews';
import ArrowsView, { ARROWS_KEY } from './trace/ArrowsView';
import * as tableGlue from './tables/tableGlue';
import * as traceGlue from './trace/traceGlue';
import * as analysisGlue from './analysis/analysisGlue';
import * as bulkClient from './perf/bulk';
import * as dataGlue from './dataGlue';
import * as pivotGlue from './pivot/pivotGlue';
import * as queryGlue from './query/queryGlue';
import * as objectGlue from './objects/objectGlue';
import * as chartGlue from './charts/chartGlue';
import * as collab from './collab/collabGlue';
import * as auto from './auto/autoGlue';
import * as perfGlue from './perf/perfGlue';
import * as linksGlue from './links/linksGlue';
import * as a11yGlue from './a11y/a11yGlue';
import * as i18nGlue from './i18n/i18nGlue';
import { CommentMarker, PeerCursor } from './collab/CollabViews';
const { refreshCharts } = chartGlue;

export interface Engine {
  api: FUniver;
  dispose: () => void;
}

export function bootEngine(container: HTMLElement, onMutation: () => void): Engine {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        sheetsCoreEnUS,
        sheetsCFEnUS,
        sheetsDVEnUS,
        sheetsFilterEnUS,
        sheetsSortEnUS,
        sheetsFindEnUS,
        sheetsLinkEnUS,
        sheetsNoteEnUS,
        sheetsDrawingEnUS,
      ),
    },
    presets: [
      UniverSheetsCorePreset({
        container,
        ribbonType: ribbonForWidth(window.innerWidth),
        formulaBar: true,
        workerURL: new Worker(new URL('./formula.worker.ts', import.meta.url), { type: 'module' }),
      }),
      UniverSheetsConditionalFormattingPreset(),
      UniverSheetsDataValidationPreset(),
      UniverSheetsFilterPreset(),
      UniverSheetsSortPreset(),
      UniverSheetsFindReplacePreset(),
      UniverSheetsHyperLinkPreset(),
      UniverSheetsNotePreset(),
      UniverSheetsDrawingPreset(),
    ],
  });

  univerAPI.registerComponent(ARROWS_KEY, ArrowsView as never);
  univerAPI.registerComponent('draco-chart', ChartView as never);
  univerAPI.registerComponent('draco-spark', SparkView as never);
  univerAPI.registerComponent('draco-shape', ShapeView as never);
  univerAPI.registerComponent('draco-diagram', DiagramView as never);
  univerAPI.registerComponent('draco-camera', CameraView as never);
  univerAPI.registerComponent('draco-slicer', SlicerView as never);
  univerAPI.registerComponent('draco-pivotbtn', PivotBtnView as never);
  univerAPI.registerComponent('draco-timeline', TimelineView as never);
  univerAPI.registerComponent(collab.MARK_KEY, CommentMarker as never);
  univerAPI.registerComponent(collab.PEER_KEY, PeerCursor as never);

  let engine: Engine; let chartTimer = 0;
  const beforeSub = univerAPI.addEvent(univerAPI.Event.BeforeCommandExecute, (e) => { if (e.type === CommandType.MUTATION) { try { collab.onBefore(e.id, e.params); } catch { /* tracking is best-effort */ } } });
  const sub = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (e) => {
    if (e.type !== CommandType.MUTATION) return;
    try { auto.onCommand(e.id, e.params, e.options as Record<string, unknown> | undefined); } catch { /* recorder is best-effort */ }
    try { collab.onCommand(e.id, e.params, e.options as Record<string, unknown> | undefined); } catch { /* collaboration is best-effort */ }
    onMutation();
    window.clearTimeout(chartTimer);
    chartTimer = window.setTimeout(() => { try { if (engine && (pivotGlue.ensureFieldButtons(engine) * 0 + (tableGlue.ensureTablesOnce(engine), 0) + pivotGlue.refreshPivots(engine) + queryGlue.refreshQueries(engine) + refreshCharts(engine) + objectGlue.refreshObjects(engine))) onMutation(); } catch { /* chart refresh is best-effort */ } }, 250);
  });

  const onResize = () => univerAPI.setRibbonType(ribbonForWidth(window.innerWidth));
  window.addEventListener('resize', onResize);

  engine = {
    api: univerAPI,
    dispose: () => {
      window.clearTimeout(chartTimer);
      window.removeEventListener('resize', onResize);
      sub.dispose(); beforeSub.dispose(); a11yGlue.dispose();
      univer.dispose();
    },
  };
  const w = window as unknown as Record<string, unknown>; w.__dracoEngine = engine; collab.attach(engine); collab.install(w); auto.attach(engine); auto.install(w); perfGlue.install(w, () => engine); analysisGlue.install(w, () => engine); traceGlue.install(w, () => engine); tableGlue.install(w, () => engine);
  engine.api.addEvent(engine.api.Event.SheetEditEnded, (p: { worksheet: { getSheetName(): string }; row: number; column: number; isConfirm: boolean }) => { if (!p.isConfirm) return; setTimeout(() => { try { traceGlue.fixSpillRefs(engine, p.worksheet.getSheetName(), p.row, p.column); const tm = tableGlue.onEdit(engine, p.worksheet.getSheetName(), p.row, p.column); if (tm) w.dracoTableNote = tm; } catch { /* ignore */ } }, 0); }); linksGlue.install(w, () => engine); a11yGlue.init(engine); i18nGlue.install(w, () => engine); void i18nGlue.restoreUi(engine);
  w.dracoPivotUI = { slicerClick: (pid: string, f: string, l: string, m: boolean) => { if (tableGlue.isTableId(pid)) tableGlue.slicerClick(engine, pid, f, l, m); else pivotGlue.slicerClick(engine, pid, f, l, m); onMutation(); }, timelineClick: (pid: string, a: number | null, b: number | null) => { pivotGlue.timelineClick(engine, pid, a, b); onMutation(); }, menu: (pid: string, f: string) => pivotGlue.fieldMenu(engine, pid, f), transform: (pid: string, kind: 'slicer' | 'timeline', f: string, dx: number, dy: number, dw: number, dh: number) => { const r = tableGlue.isTableId(pid) ? tableGlue.transformSlicer(engine, pid, f, dx, dy, dw, dh) : pivotGlue.transformWidget(engine, pid, kind, f, dx, dy, dw, dh); onMutation(); return r; } };
  w.dracoData = { dedupe: (cols: number[], header: boolean, cs: boolean) => { const t = performance.now(); const r = dataGlue.dedupeRun(engine, cols, header, cs); return { ...r, ms: Math.round(performance.now() - t) }; }, dedupeAsync: async (cols: number[], header: boolean, cs: boolean) => { const t = performance.now(); const r = await dataGlue.dedupeRunAsync(engine, cols, header, cs); return { ...r, ms: Math.round(performance.now() - t) }; }, stats: (ref?: string) => dataGlue.columnStatsRun(engine, ref), workerInfo: () => ({ ...bulkClient.stats }) };
  w.dracoPivots = {
    create: (o: Parameters<typeof pivotGlue.createPivot>[1]) => pivotGlue.createPivot(engine, o), update: (id: string, p: Parameters<typeof pivotGlue.updatePivot>[2]) => pivotGlue.updatePivot(engine, id, p), remove: (id: string) => pivotGlue.removePivot(engine, id),
    list: () => pivotGlue.getPivots(), refresh: (force?: boolean) => pivotGlue.refreshPivots(engine, force), slicer: (id: string, f: string, k: 'slicer' | 'timeline') => pivotGlue.addSlicer(engine, id, f, k), click: pivotGlue.slicerClick.bind(null, engine), chart: (id: string, t: never, title?: string) => pivotGlue.createPivotChart(engine, id, t, title), fields: (s: string, r: string) => pivotGlue.sourceFields(engine, s, r),
  };
  w.dracoQueries = { save: (o: Parameters<typeof queryGlue.saveQuery>[1]) => queryGlue.saveQuery(engine, o), list: () => queryGlue.getQueries(), preview: (d: Parameters<typeof queryGlue.previewQuery>[1]) => queryGlue.previewQuery(engine, d), load: (id: string) => { const q = queryGlue.getQuery(id); return q ? queryGlue.loadToSheet(engine, q) : { ok: false, message: 'Query not found' }; }, remove: (id: string, clear?: boolean) => queryGlue.removeQuery(engine, id, clear), refresh: (force?: boolean) => queryGlue.refreshQueries(engine, force) };
  (window as unknown as { dracoCharts: unknown }).dracoCharts = {
    create: (o: Parameters<typeof chartGlue.createChart>[1]) => chartGlue.createChart(engine, o),
    update: (id: string, p: Parameters<typeof chartGlue.updateChart>[2]) => chartGlue.updateChart(engine, id, p),
    remove: (id: string) => chartGlue.removeChart(engine, id),
    sparkline: (o: Parameters<typeof objectGlue.createSparklines>[1]) => objectGlue.createSparklines(engine, o), sparkOpts: (loc: string, o: object) => objectGlue.setSparkOpts(engine, loc, o), sparkClear: (s: 'selection' | 'sheet') => objectGlue.clearSparklines(engine, s),
    shape: (d: Parameters<typeof objectGlue.addShape>[1], w?: number, h?: number, a?: string) => objectGlue.addShape(engine, d, w, h, a), diagram: (d: Parameters<typeof objectGlue.addDiagram>[1], w?: number, h?: number, a?: string) => objectGlue.addDiagram(engine, d, w, h, a),
    camera: (r?: string, a?: string) => objectGlue.addCamera(engine, r, a), objects: (...k: string[]) => objectGlue.listObjects(engine, ...k), updateObject: (id: string, p: object) => objectGlue.updateObject(engine, id, p), removeObject: (id: string) => objectGlue.removeObject(engine, id), list: () => chartGlue.listCharts(engine), refresh: () => chartGlue.refreshCharts(engine),
  }; // used by tests and, later, macros/scripting
  return engine;
}

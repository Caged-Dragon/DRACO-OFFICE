import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Dialog from '../Dialog';
import type { Engine } from '../engine';
import { PALETTE_NAMES, PALETTES, renderChart, type ChartOpts, type ChartSpec, type ChartType, type Trend } from './render';
import { buildSpec, chartDefault, createChart, listCharts, removeChart, updateChart, type ChartInfo } from './chartGlue';
import { MAP_KINDS } from './maps';
import { parseRef, readValues, type Out } from '../dataGlue';

export const CHART_TYPES: Array<[ChartType, string]> = [
  ['column', 'Column'], ['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['pie', 'Pie'], ['doughnut', 'Doughnut'], ['scatter', 'Scatter'], ['bubble', 'Bubble'], ['radar', 'Radar'],
  ['stock', 'Stock'], ['combo', 'Combo'], ['waterfall', 'Waterfall'], ['funnel', 'Funnel'], ['histogram', 'Histogram'], ['box', 'Box & whisker'], ['treemap', 'Treemap'], ['sunburst', 'Sunburst'], ['surface', 'Surface (top view)'], ['surface3d', '3-D surface'], ['map', 'Map (US / India / World)'],
];
const SAMPLE_C = ['A', 'B', 'C', 'D', 'E']; const S1 = [4, 7, 5, 9, 6], S2 = [3, 5, 6, 4, 8];
const SAMPLE: Record<ChartType, ChartSpec> = Object.fromEntries(CHART_TYPES.map(([t]) => [t, { type: t, categories: SAMPLE_C, series: [{ name: 'a', values: S1 }, { name: 'b', values: S2 }], opts: { legend: 'none', labels: false } } as ChartSpec])) as never;
SAMPLE.pie.series = [SAMPLE.pie.series[0]]; SAMPLE.doughnut.series = [SAMPLE.doughnut.series[0]]; SAMPLE.funnel.series = [{ name: 'a', values: [9, 7, 5, 3, 1] }]; SAMPLE.treemap.series = [SAMPLE.treemap.series[0]];
SAMPLE.sunburst = { ...SAMPLE.sunburst, categories: ['X/1', 'X/2', 'Y/1', 'Y/2', 'Z'], series: [SAMPLE.sunburst.series[0]] };
SAMPLE.scatter = { type: 'scatter', categories: [], series: [{ name: 'a', values: [2, 4, 3, 7, 6], xs: [1, 2, 3, 4, 5] }], opts: { legend: 'none' } };
SAMPLE.bubble = { type: 'bubble', categories: [], series: [{ name: 'a', values: [2, 4, 3, 7, 6], xs: [1, 2, 3, 4, 5], sizes: [3, 9, 5, 12, 2] }], opts: { legend: 'none' } };
SAMPLE.waterfall = { type: 'waterfall', categories: ['S', 'U', 'D', 'U', 'Total'], series: [{ name: 'a', values: [5, 4, -3, 2, 0] }], opts: { legend: 'none' } };
SAMPLE.stock = { type: 'stock', categories: ['1', '2', '3', '4'], series: [{ name: 'o', values: [10, 12, 11, 13] }, { name: 'h', values: [14, 15, 13, 16] }, { name: 'l', values: [9, 11, 9, 12] }, { name: 'c', values: [12, 11, 12, 15] }], opts: { legend: 'none' } };
SAMPLE.combo = { ...SAMPLE.combo, series: [{ name: 'a', values: S1, kind: 'column' }, { name: 'b', values: S2, kind: 'line', secondary: true }] };
SAMPLE.histogram = { type: 'histogram', categories: [], series: [{ name: 'a', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 8] }], opts: { legend: 'none', bins: 4 } };
SAMPLE.surface = { type: 'surface', categories: ['1', '2', '3', '4'], series: [{ name: 'a', values: [1, 3, 5, 7] }, { name: 'b', values: [2, 4, 6, 8] }, { name: 'c', values: [5, 6, 3, 1] }], opts: {} };
SAMPLE.surface3d = { type: 'surface3d', categories: ['1', '2', '3', '4', '5'], series: [{ name: 'a', values: [1, 3, 5, 7, 4] }, { name: 'b', values: [2, 4, 6, 8, 5] }, { name: 'c', values: [5, 6, 3, 1, 2] }, { name: 'd', values: [3, 2, 4, 6, 8] }], opts: {} };
SAMPLE.map = { type: 'map', categories: ['CA', 'TX', 'NY', 'FL', 'WA'], series: [{ name: 'a', values: [9, 7, 8, 5, 3] }], opts: { map: 'us' } };
SAMPLE.box = { type: 'box', categories: [], series: [{ name: 'a', values: [1, 3, 4, 5, 6, 7, 20] }, { name: 'b', values: [2, 3, 5, 6, 8, 9] }], opts: { legend: 'none' } };

const STYLES: Array<[string, ChartOpts]> = [
  ['Style 1', { palette: 'office', grid: true, theme: 'light' }], ['Style 2', { palette: 'vivid', grid: true, labels: true }], ['Style 3', { palette: 'pastel', grid: false }],
  ['Style 4', { palette: 'ocean', grid: true, smooth: true }], ['Style 5', { palette: 'sunset', grid: false, labels: true }], ['Style 6', { palette: 'draco', theme: 'dark', grid: true }], ['Mono', { palette: 'mono', grid: true }],
];
const TKEY = 'draco:chart-templates';
const loadTpl = (): Record<string, ChartOpts & { __type?: ChartType }> => { try { return JSON.parse(localStorage.getItem(TKEY) ?? '{}'); } catch { return {}; } };
const saveTpl = (t: Record<string, unknown>) => { try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch { /* storage unavailable */ } };

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => <label className="inline"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
const Result = ({ r }: { r: Out | null }) => (r ? <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p> : null);
const num = (v: string): number | undefined => (v.trim() === '' || !Number.isFinite(+v) ? undefined : +v);

interface Form { type: ChartType; range: string; title: string; byRows: boolean; opts: ChartOpts; w?: number; h?: number }

export default function ChartDialog({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [tab, setTab] = useState<'insert' | 'manage'>('insert');
  return (
    <Dialog title="Charts" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'insert'} className={tab === 'insert' ? 'on' : ''} onClick={() => setTab('insert')}>Insert chart</button>
        <button role="tab" aria-selected={tab === 'manage'} className={tab === 'manage' ? 'on' : ''} onClick={() => setTab('manage')}>Manage charts</button>
      </div>
      {tab === 'insert' ? <Insert engine={engine} onDone={onClose} /> : <Manage engine={engine} />}
    </Dialog>
  );
}

function Insert({ engine, onDone }: { engine: Engine; onDone: () => void }) {
  const def = useMemo(() => chartDefault(engine), [engine]);
  const [f, setF] = useState<Form>({ type: 'column', range: def ? (def.sheet === engine.api.getActiveWorkbook()?.getActiveSheet().getSheetName() ? def.range : `${def.sheet}!${def.range}`) : '', title: '', byRows: false, opts: { legend: 'bottom', grid: true } });
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="chart-types" role="radiogroup" aria-label="Chart type">
        {CHART_TYPES.map(([t, l]) => <button key={t} role="radio" aria-checked={f.type === t} className={'ctype' + (f.type === t ? ' on' : '')} onClick={() => setF({ ...f, type: t })} title={l}><span dangerouslySetInnerHTML={{ __html: renderChart(SAMPLE[t], 96, 62) }} /><small>{l}</small></button>)}
      </div>
      <FormBody engine={engine} f={f} setF={setF} />
      <div className="row-btns"><button className="primary" onClick={() => { const o = createChart(engine, { range: f.range, type: f.type, title: f.title, byRows: f.byRows, opts: f.opts }); setR(o); if (o.ok) setTimeout(onDone, 500); }}>Insert chart</button></div>
      <Result r={r} />
    </>
  );
}

function FormBody({ engine, f, setF }: { engine: Engine; f: Form; setF: (f: Form) => void }) {
  const o = f.opts; const set = (p: Partial<ChartOpts>) => setF({ ...f, opts: { ...o, ...p } });
  const tr = o.trend; const setTr = (p: Partial<Trend> | null) => set({ trend: p === null ? undefined : { type: 'linear', ...(tr ?? {}), ...p } });
  const [tpl, setTpl] = useState(loadTpl); const [tname, setTname] = useState('');
  const preview = useMemo(() => {
    try {
      const l = f.range ? parseRef(engine, f.range) : null; if (!l) return '<p class="hint">Enter a valid range to preview.</p>';
      const spec = buildSpec({ type: f.type, title: f.title, byRows: f.byRows, opts: o }, readValues(l) as never); return renderChart(spec, 460, 280);
    } catch { return '<p class="hint">Preview unavailable.</p>'; }
  }, [engine, f, o]);
  const xy = f.type === 'scatter' || f.type === 'bubble'; const axisT = !['pie', 'doughnut', 'radar', 'treemap', 'sunburst', 'funnel', 'box', 'surface', 'surface3d', 'map'].includes(f.type);
  const trendable = ['column', 'bar', 'line', 'area', 'scatter', 'bubble', 'combo'].includes(f.type);
  return (
    <div className="chart-form">
      <div className="stack">
        <Field label="Data range"><input value={f.range} onChange={(e) => setF({ ...f, range: e.target.value })} placeholder="e.g. A1:C7 or Sheet2!A1:D10" /></Field>
        <Field label="Chart title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Check label="Switch row / column (series in rows)" checked={f.byRows} onChange={(v) => setF({ ...f, byRows: v })} />
        <div className="grid2">
          <Field label="Legend"><select value={o.legend ?? 'bottom'} onChange={(e) => set({ legend: e.target.value as ChartOpts['legend'] })}>{['bottom', 'top', 'left', 'right', 'none'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Colors"><select value={o.palette ?? 'office'} onChange={(e) => set({ palette: e.target.value })}>{PALETTE_NAMES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          {['column', 'bar', 'area'].includes(f.type) && <Field label="Stacking"><select value={o.stack ?? 'none'} onChange={(e) => set({ stack: e.target.value as ChartOpts['stack'] })}><option value="none">Clustered</option><option value="stacked">Stacked</option><option value="percent">100% stacked</option></select></Field>}
          <Field label="Theme"><select value={o.theme ?? 'light'} onChange={(e) => set({ theme: e.target.value as 'light' | 'dark' })}><option>light</option><option>dark</option></select></Field>
        </div>
        {f.type === 'map' && <Field label="Map"><select aria-label="Map region" value={o.map ?? 'us'} onChange={(e) => set({ map: e.target.value as ChartOpts['map'] })}>{MAP_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
        {f.type === 'surface3d' && <div className="grid2"><Field label="Rotation (°)"><input type="number" aria-label="Rotation" value={o.azimuth ?? 35} onChange={(e) => set({ azimuth: +e.target.value })} /></Field><Field label="Elevation (°)"><input type="number" aria-label="Elevation" value={o.elevation ?? 30} onChange={(e) => set({ elevation: +e.target.value })} /></Field></div>}
        {axisT && <div className="grid2"><Field label={xy ? 'X axis title' : 'Category axis title'}><input value={o.xTitle ?? ''} onChange={(e) => set({ xTitle: e.target.value })} /></Field><Field label="Value axis title"><input value={o.yTitle ?? ''} onChange={(e) => set({ yTitle: e.target.value })} /></Field>{f.type === 'combo' && <Field label="Secondary axis title"><input value={o.y2Title ?? ''} onChange={(e) => set({ y2Title: e.target.value })} /></Field>}</div>}
        <div className="checks">
          <Check label="Data labels" checked={!!o.labels} onChange={(v) => set({ labels: v })} />
          {axisT && <Check label="Gridlines" checked={o.grid !== false} onChange={(v) => set({ grid: v })} />}
          {['line', 'area', 'combo'].includes(f.type) && <Check label="Smooth lines" checked={!!o.smooth} onChange={(v) => set({ smooth: v })} />}
          {['line', 'combo'].includes(f.type) && <Check label="Markers" checked={o.markers !== false} onChange={(v) => set({ markers: v })} />}
          {axisT && f.type !== 'bar' && f.type !== 'histogram' && <Check label="Log scale" checked={!!o.logY} onChange={(v) => set({ logY: v })} />}
        </div>
        {f.type === 'histogram' && <div className="grid2"><Field label="Number of bins"><input type="number" min={1} value={o.bins ?? ''} onChange={(e) => set({ bins: num(e.target.value), binWidth: undefined })} placeholder="automatic" /></Field><Field label="Or bin width"><input type="number" min={0} value={o.binWidth ?? ''} onChange={(e) => set({ binWidth: num(e.target.value), bins: undefined })} placeholder="automatic" /></Field></div>}
        {f.type === 'doughnut' && <Field label={`Hole size ${Math.round((o.hole ?? 0.55) * 100)}%`}><input type="range" min={20} max={85} value={Math.round((o.hole ?? 0.55) * 100)} onChange={(e) => set({ hole: +e.target.value / 100 })} /></Field>}
        {axisT && <div className="grid2"><Field label="Axis minimum"><input type="number" value={o.yMin ?? ''} onChange={(e) => set({ yMin: num(e.target.value) })} placeholder="auto" /></Field><Field label="Axis maximum"><input type="number" value={o.yMax ?? ''} onChange={(e) => set({ yMax: num(e.target.value) })} placeholder="auto" /></Field></div>}
        {trendable && <>
          <div className="grid2">
            <Field label="Trendline"><select value={tr?.type ?? ''} onChange={(e) => (e.target.value ? setTr({ type: e.target.value as Trend['type'] }) : setTr(null))}><option value="">None</option><option value="linear">Linear</option><option value="exp">Exponential</option><option value="log">Logarithmic</option><option value="power">Power</option><option value="poly">Polynomial</option><option value="ma">Moving average</option></select></Field>
            {tr?.type === 'poly' && <Field label="Order"><input type="number" min={2} max={6} value={tr.degree ?? 2} onChange={(e) => setTr({ degree: Math.min(6, Math.max(2, +e.target.value || 2)) })} /></Field>}
            {tr?.type === 'ma' && <Field label="Period"><input type="number" min={2} max={50} value={tr.period ?? 2} onChange={(e) => setTr({ period: Math.max(2, +e.target.value || 2) })} /></Field>}
            {tr && tr.type !== 'ma' && <Field label="Forecast forward (periods)"><input type="number" min={0} value={tr.forward ?? 0} onChange={(e) => setTr({ forward: Math.max(0, +e.target.value || 0) })} /></Field>}
          </div>
          {tr && tr.type !== 'ma' && <div className="checks"><Check label="Show equation" checked={!!tr.showEq} onChange={(v) => setTr({ showEq: v })} /><Check label="Show R²" checked={!!tr.showR2} onChange={(v) => setTr({ showR2: v })} /></div>}
          <div className="grid2">
            <Field label="Error bars"><select value={o.err?.kind ?? ''} onChange={(e) => set({ err: e.target.value ? { kind: e.target.value as 'fixed' | 'pct' | 'stdev', value: o.err?.value } : undefined })}><option value="">None</option><option value="fixed">Fixed value</option><option value="pct">Percentage</option><option value="stdev">Standard deviation(s)</option></select></Field>
            {o.err && <Field label="Amount"><input type="number" value={o.err.value ?? ''} onChange={(e) => set({ err: { ...o.err!, value: num(e.target.value) } })} placeholder={o.err.kind === 'pct' ? '5' : '1'} /></Field>}
          </div>
        </>}
        <div><strong>Quick styles</strong><div className="swatches">{STYLES.map(([n, so]) => <button key={n} className="swatch-btn" onClick={() => set({ ...so })} title={n}>{n}<span>{(PALETTES[so.palette ?? 'office']).slice(0, 4).map((c) => <i key={c} style={{ background: c }} />)}</span></button>)}</div></div>
        <div><strong>Chart templates</strong>
          <div className="row-btns"><input value={tname} onChange={(e) => setTname(e.target.value)} placeholder="Template name" /><button disabled={!tname.trim()} onClick={() => { const n = { ...tpl, [tname.trim()]: { ...o, __type: f.type } }; saveTpl(n); setTpl(n); setTname(''); }}>Save as template</button></div>
          {Object.keys(tpl).map((n) => <div key={n} className="row-btns"><span>{n}</span><button onClick={() => { const { __type, ...rest } = tpl[n]; setF({ ...f, type: __type ?? f.type, opts: rest }); }}>Apply</button><button onClick={() => { const c = { ...tpl }; delete c[n]; saveTpl(c); setTpl(c); }}>Delete</button></div>)}
        </div>
      </div>
      <div className="chart-preview" aria-label="Chart preview" dangerouslySetInnerHTML={{ __html: preview }} />
    </div>
  );
}

function Manage({ engine }: { engine: Engine }) {
  const [mv, setMv] = useState(''); const [list, setList] = useState<ChartInfo[]>(() => listCharts(engine)); const [sel, setSel] = useState<string | null>(null); const [f, setF] = useState<Form | null>(null); const [r, setR] = useState<Out | null>(null);
  const refresh = () => setList(listCharts(engine));
  useEffect(() => { if (!sel) { setF(null); return; } const c = list.find((x) => x.id === sel); const wb = engine.api.getActiveWorkbook(); if (!c || !wb) return;
    for (const ws of wb.getSheets()) { const d = ws.getFloatDomById(sel); if (d?.data) { const x = d.data as unknown as { type: ChartType; title: string; byRows: boolean; opts: ChartOpts; range: string; sheet: string }; setF({ type: x.type, range: `${x.sheet}!${x.range}`, title: x.title, byRows: x.byRows, opts: x.opts, w: c.w, h: c.h }); break; } } }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return <p className="hint">No charts yet. Select your data and use “Insert chart”.</p>;
  return (
    <>
      <ul className="chart-list">{list.map((c) => <li key={c.id}><button className={sel === c.id ? 'on' : ''} onClick={() => setSel(c.id)}>{c.title || `${c.type} chart`} <small>· {c.sheet}!{c.range}</small></button></li>)}</ul>
      {f && sel && <>
        <div className="chart-types">{CHART_TYPES.map(([t, l]) => <button key={t} role="radio" aria-checked={f.type === t} className={'ctype' + (f.type === t ? ' on' : '')} onClick={() => setF({ ...f, type: t })} title={l}><span dangerouslySetInnerHTML={{ __html: renderChart(SAMPLE[t], 96, 62) }} /><small>{l}</small></button>)}</div>
        <FormBody engine={engine} f={f} setF={setF} />
        <div className="grid2"><Field label="Width (px)"><input type="number" min={160} value={f.w ?? ''} onChange={(e) => setF({ ...f, w: num(e.target.value) })} /></Field><Field label="Height (px)"><input type="number" min={120} value={f.h ?? ''} onChange={(e) => setF({ ...f, h: num(e.target.value) })} /></Field></div>
        <Field label="Move to cell (top-left corner)"><input value={mv} onChange={(e) => setMv(e.target.value)} placeholder="e.g. H10 (blank = keep)" /></Field>
        <div className="row-btns">
          <button className="primary" onClick={() => { const rng = f.range.includes('!') ? f.range.slice(f.range.lastIndexOf('!') + 1) : f.range; setR(updateChart(engine, sel, { type: f.type, title: f.title, byRows: f.byRows, range: rng, opts: f.opts, w: f.w, h: f.h, at: mv || undefined })); setMv(''); refresh(); }}>Apply changes</button>
          <button onClick={() => { setR(removeChart(engine, sel)); setSel(null); refresh(); }}>Delete chart</button>
        </div>
      </>}
      <Result r={r} />
    </>
  );
}

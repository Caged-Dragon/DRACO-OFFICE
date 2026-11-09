import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { PALETTE_NAMES, PALETTES, renderChart, type ChartOpts, type Trend } from '../render';
import { buildSpec } from '../chartGlue';
import { MAP_KINDS } from '../maps';
import { parseRef, readValues } from '../../data/dataGlue';
import { Check, Field, Form, STYLES, loadTpl, num, saveTpl } from './shared';

export function FormBody({ engine, f, setF }: { engine: Engine; f: Form; setF: (f: Form) => void }) {
  const o = f.opts;
  const set = (p: Partial<ChartOpts>) => setF({ ...f, opts: { ...o, ...p } });
  const tr = o.trend;
  const setTr = (p: Partial<Trend> | null) =>
    set({ trend: p === null ? undefined : { type: 'linear', ...(tr ?? {}), ...p } });
  const [tpl, setTpl] = useState(loadTpl);
  const [tname, setTname] = useState('');
  const preview = useMemo(() => {
    try {
      const l = f.range ? parseRef(engine, f.range) : null;
      if (!l) return '<p class="hint">Enter a valid range to preview.</p>';
      const spec = buildSpec({ type: f.type, title: f.title, byRows: f.byRows, opts: o }, readValues(l) as never);
      return renderChart(spec, 460, 280);
    } catch {
      return '<p class="hint">Preview unavailable.</p>';
    }
  }, [engine, f, o]);
  const xy = f.type === 'scatter' || f.type === 'bubble';
  const axisT = ![
    'pie',
    'doughnut',
    'radar',
    'treemap',
    'sunburst',
    'funnel',
    'box',
    'surface',
    'surface3d',
    'map',
  ].includes(f.type);
  const trendable = ['column', 'bar', 'line', 'area', 'scatter', 'bubble', 'combo'].includes(f.type);
  return (
    <div className="chart-form">
      <div className="stack">
        <Field label="Data range">
          <input
            value={f.range}
            onChange={(e) => setF({ ...f, range: e.target.value })}
            placeholder="e.g. A1:C7 or Sheet2!A1:D10"
          />
        </Field>
        <Field label="Chart title">
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Check
          label="Switch row / column (series in rows)"
          checked={f.byRows}
          onChange={(v) => setF({ ...f, byRows: v })}
        />
        <div className="grid2">
          <Field label="Legend">
            <select
              value={o.legend ?? 'bottom'}
              onChange={(e) => set({ legend: e.target.value as ChartOpts['legend'] })}
            >
              {['bottom', 'top', 'left', 'right', 'none'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Colors">
            <select value={o.palette ?? 'office'} onChange={(e) => set({ palette: e.target.value })}>
              {PALETTE_NAMES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          {['column', 'bar', 'area'].includes(f.type) && (
            <Field label="Stacking">
              <select value={o.stack ?? 'none'} onChange={(e) => set({ stack: e.target.value as ChartOpts['stack'] })}>
                <option value="none">Clustered</option>
                <option value="stacked">Stacked</option>
                <option value="percent">100% stacked</option>
              </select>
            </Field>
          )}
          <Field label="Theme">
            <select value={o.theme ?? 'light'} onChange={(e) => set({ theme: e.target.value as 'light' | 'dark' })}>
              <option>light</option>
              <option>dark</option>
            </select>
          </Field>
        </div>
        {f.type === 'map' && (
          <Field label="Map">
            <select
              aria-label="Map region"
              value={o.map ?? 'us'}
              onChange={(e) => set({ map: e.target.value as ChartOpts['map'] })}
            >
              {MAP_KINDS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
        {f.type === 'surface3d' && (
          <div className="grid2">
            <Field label="Rotation (°)">
              <input
                type="number"
                aria-label="Rotation"
                value={o.azimuth ?? 35}
                onChange={(e) => set({ azimuth: +e.target.value })}
              />
            </Field>
            <Field label="Elevation (°)">
              <input
                type="number"
                aria-label="Elevation"
                value={o.elevation ?? 30}
                onChange={(e) => set({ elevation: +e.target.value })}
              />
            </Field>
          </div>
        )}
        {axisT && (
          <div className="grid2">
            <Field label={xy ? 'X axis title' : 'Category axis title'}>
              <input value={o.xTitle ?? ''} onChange={(e) => set({ xTitle: e.target.value })} />
            </Field>
            <Field label="Value axis title">
              <input value={o.yTitle ?? ''} onChange={(e) => set({ yTitle: e.target.value })} />
            </Field>
            {f.type === 'combo' && (
              <Field label="Secondary axis title">
                <input value={o.y2Title ?? ''} onChange={(e) => set({ y2Title: e.target.value })} />
              </Field>
            )}
          </div>
        )}
        <div className="checks">
          <Check label="Data labels" checked={!!o.labels} onChange={(v) => set({ labels: v })} />
          {axisT && <Check label="Gridlines" checked={o.grid !== false} onChange={(v) => set({ grid: v })} />}
          {['line', 'area', 'combo'].includes(f.type) && (
            <Check label="Smooth lines" checked={!!o.smooth} onChange={(v) => set({ smooth: v })} />
          )}
          {['line', 'combo'].includes(f.type) && (
            <Check label="Markers" checked={o.markers !== false} onChange={(v) => set({ markers: v })} />
          )}
          {axisT && f.type !== 'bar' && f.type !== 'histogram' && (
            <Check label="Log scale" checked={!!o.logY} onChange={(v) => set({ logY: v })} />
          )}
        </div>
        {f.type === 'histogram' && (
          <div className="grid2">
            <Field label="Number of bins">
              <input
                type="number"
                min={1}
                value={o.bins ?? ''}
                onChange={(e) => set({ bins: num(e.target.value), binWidth: undefined })}
                placeholder="automatic"
              />
            </Field>
            <Field label="Or bin width">
              <input
                type="number"
                min={0}
                value={o.binWidth ?? ''}
                onChange={(e) => set({ binWidth: num(e.target.value), bins: undefined })}
                placeholder="automatic"
              />
            </Field>
          </div>
        )}
        {f.type === 'doughnut' && (
          <Field label={`Hole size ${Math.round((o.hole ?? 0.55) * 100)}%`}>
            <input
              type="range"
              min={20}
              max={85}
              value={Math.round((o.hole ?? 0.55) * 100)}
              onChange={(e) => set({ hole: +e.target.value / 100 })}
            />
          </Field>
        )}
        {axisT && (
          <div className="grid2">
            <Field label="Axis minimum">
              <input
                type="number"
                value={o.yMin ?? ''}
                onChange={(e) => set({ yMin: num(e.target.value) })}
                placeholder="auto"
              />
            </Field>
            <Field label="Axis maximum">
              <input
                type="number"
                value={o.yMax ?? ''}
                onChange={(e) => set({ yMax: num(e.target.value) })}
                placeholder="auto"
              />
            </Field>
          </div>
        )}
        {trendable && (
          <>
            <div className="grid2">
              <Field label="Trendline">
                <select
                  value={tr?.type ?? ''}
                  onChange={(e) => (e.target.value ? setTr({ type: e.target.value as Trend['type'] }) : setTr(null))}
                >
                  <option value="">None</option>
                  <option value="linear">Linear</option>
                  <option value="exp">Exponential</option>
                  <option value="log">Logarithmic</option>
                  <option value="power">Power</option>
                  <option value="poly">Polynomial</option>
                  <option value="ma">Moving average</option>
                </select>
              </Field>
              {tr?.type === 'poly' && (
                <Field label="Order">
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={tr.degree ?? 2}
                    onChange={(e) => setTr({ degree: Math.min(6, Math.max(2, +e.target.value || 2)) })}
                  />
                </Field>
              )}
              {tr?.type === 'ma' && (
                <Field label="Period">
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={tr.period ?? 2}
                    onChange={(e) => setTr({ period: Math.max(2, +e.target.value || 2) })}
                  />
                </Field>
              )}
              {tr && tr.type !== 'ma' && (
                <Field label="Forecast forward (periods)">
                  <input
                    type="number"
                    min={0}
                    value={tr.forward ?? 0}
                    onChange={(e) => setTr({ forward: Math.max(0, +e.target.value || 0) })}
                  />
                </Field>
              )}
            </div>
            {tr && tr.type !== 'ma' && (
              <div className="checks">
                <Check label="Show equation" checked={!!tr.showEq} onChange={(v) => setTr({ showEq: v })} />
                <Check label="Show R²" checked={!!tr.showR2} onChange={(v) => setTr({ showR2: v })} />
              </div>
            )}
            <div className="grid2">
              <Field label="Error bars">
                <select
                  value={o.err?.kind ?? ''}
                  onChange={(e) =>
                    set({
                      err: e.target.value
                        ? { kind: e.target.value as 'fixed' | 'pct' | 'stdev', value: o.err?.value }
                        : undefined,
                    })
                  }
                >
                  <option value="">None</option>
                  <option value="fixed">Fixed value</option>
                  <option value="pct">Percentage</option>
                  <option value="stdev">Standard deviation(s)</option>
                </select>
              </Field>
              {o.err && (
                <Field label="Amount">
                  <input
                    type="number"
                    value={o.err.value ?? ''}
                    onChange={(e) => set({ err: { ...o.err!, value: num(e.target.value) } })}
                    placeholder={o.err.kind === 'pct' ? '5' : '1'}
                  />
                </Field>
              )}
            </div>
          </>
        )}
        <div>
          <strong>Quick styles</strong>
          <div className="swatches">
            {STYLES.map(([n, so]) => (
              <button key={n} className="swatch-btn" onClick={() => set({ ...so })} title={n}>
                {n}
                <span>
                  {PALETTES[so.palette ?? 'office'].slice(0, 4).map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <strong>Chart templates</strong>
          <div className="row-btns">
            <input value={tname} onChange={(e) => setTname(e.target.value)} placeholder="Template name" />
            <button
              disabled={!tname.trim()}
              onClick={() => {
                const n = { ...tpl, [tname.trim()]: { ...o, __type: f.type } };
                saveTpl(n);
                setTpl(n);
                setTname('');
              }}
            >
              Save as template
            </button>
          </div>
          {Object.keys(tpl).map((n) => (
            <div key={n} className="row-btns">
              <span>{n}</span>
              <button
                onClick={() => {
                  const { __type, ...rest } = tpl[n];
                  setF({ ...f, type: __type ?? f.type, opts: rest });
                }}
              >
                Apply
              </button>
              <button
                onClick={() => {
                  const c = { ...tpl };
                  delete c[n];
                  saveTpl(c);
                  setTpl(c);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-preview" aria-label="Chart preview" dangerouslySetInnerHTML={{ __html: preview }} />
    </div>
  );
}

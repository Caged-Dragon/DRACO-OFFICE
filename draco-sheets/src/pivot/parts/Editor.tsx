import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Engine } from '../../core/engine';
import { CHART_TYPES } from '../../charts/parts/shared';
import type { ChartType } from '../../charts/render';
import { goTo, type Out } from '../../data/dataGlue';
import { AGG_LABEL, SHOW_AS_LABEL, type Agg, type PivotConfig, type ShowAs, type ValueField } from '../pivot';
import {
  addSlicer,
  createPivotChart,
  getPivot,
  removePivot,
  removeWidget,
  sourceFields,
  updatePivot,
  type PivotDef,
} from '../pivotGlue';
import { FilterBox } from './FilterBox';
import { Check, Field, Result, move } from './shared';

export function Editor({
  engine,
  def,
  onChange,
  onDeleted,
}: {
  engine: Engine;
  def: PivotDef;
  onChange: () => void;
  onDeleted: () => void;
}) {
  const [cfg, setCfg] = useState<PivotConfig>(() => structuredClone(def.cfg));
  const [r, setR] = useState<Out | null>(null);
  const [name, setName] = useState(def.name);
  const [src, setSrc] = useState(def.srcRange);
  const [anchor, setAnchor] = useState(def.anchor);
  const [auto, setAuto] = useState(def.auto);
  const info = useMemo(() => sourceFields(engine, def.srcSheet, src), [engine, def.srcSheet, src, def.sig]);
  const calcNames = (cfg.calc ?? []).map((c) => c.name);
  const fields = [...(info?.fields ?? []), ...calcNames];
  const [pick, setPick] = useState('');
  const [cn, setCn] = useState('');
  const [cf, setCf] = useState('');
  const [wf, setWf] = useState('');
  const [ct, setCt] = useState<ChartType>('column');
  const [binF, setBinF] = useState('');
  const [binS, setBinS] = useState('0');
  const [binW, setBinW] = useState('10');
  useEffect(() => {
    if (!pick && fields.length) setPick(fields[0]);
  }, [fields.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<PivotConfig>) => setCfg({ ...cfg, ...p });
  const addTo = (area: 'rows' | 'cols' | 'values' | 'filters') => {
    if (!pick) return;
    if (area === 'rows' || area === 'cols') {
      const other = area === 'rows' ? 'cols' : 'rows';
      setCfg({
        ...cfg,
        [area]: cfg[area].includes(pick) ? cfg[area] : [...cfg[area], pick],
        [other]: cfg[other].filter((x) => x !== pick),
      });
    } else if (area === 'values') {
      const numeric = calcNames.includes(pick) || !/\(Years\)|\(Quarters\)|\(Months\)/.test(pick);
      set({ values: [...cfg.values, { field: pick, agg: numeric && !calcNames.includes(pick) ? 'sum' : 'sum' }] });
    } else if (!cfg.filters.some((f) => f.field === pick))
      set({ filters: [...cfg.filters, { field: pick, exclude: [] }] });
  };
  const apply = () => {
    const o = updatePivot(engine, def.id, { name, srcRange: src, anchor, auto, cfg });
    setR(o);
    onChange();
    if (o.ok) setCfg(structuredClone(getPivot(def.id)!.cfg));
  };
  const chip = (label: string, i: number, arr: unknown[], upd: (a: never[]) => void, extra?: ReactNode) => (
    <li key={label + i} className="chip">
      <span>{label}</span>
      {extra}
      <button title="Move up" onClick={() => upd(move(arr as never[], i, -1))}>
        ↑
      </button>
      <button title="Move down" onClick={() => upd(move(arr as never[], i, 1))}>
        ↓
      </button>
      <button
        title="Remove"
        aria-label={`Remove ${label}`}
        onClick={() => upd((arr as never[]).filter((_, k) => k !== i))}
      >
        ✕
      </button>
    </li>
  );
  const setVal = (i: number, p: Partial<ValueField>) =>
    set({ values: cfg.values.map((v, k) => (k === i ? { ...v, ...p } : v)) });
  const dateFlds = info?.dateFields ?? [];
  return (
    <div className="stack">
      <div className="grid2">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Source range">
          <input value={src} onChange={(e) => setSrc(e.target.value)} />
        </Field>
        <Field label="Located at">
          <input value={anchor} onChange={(e) => setAnchor(e.target.value)} />
        </Field>
        <Check label="Refresh automatically when source data changes" checked={auto} onChange={setAuto} />
      </div>
      <div className="grid2" style={{ alignItems: 'end' }}>
        <Field label="Add field">
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <div className="row-btns">
          <button onClick={() => addTo('rows')}>→ Rows</button>
          <button onClick={() => addTo('cols')}>→ Columns</button>
          <button onClick={() => addTo('values')}>→ Values</button>
          <button onClick={() => addTo('filters')}>→ Filters</button>
        </div>
      </div>
      <div className="grid2">
        <div>
          <strong>Rows</strong>
          <ul className="chips">
            {cfg.rows.map((f, i) =>
              chip(
                f,
                i,
                cfg.rows,
                (a) => set({ rows: a }),
                <select
                  aria-label={`Sort ${f}`}
                  value={cfg.sortByValue?.[f] ? 'v' + cfg.sortByValue[f] : (cfg.sort?.[f] ?? 'asc')}
                  onChange={(e) => {
                    const v = e.target.value;
                    const sort = { ...(cfg.sort ?? {}) };
                    const sbv = { ...(cfg.sortByValue ?? {}) };
                    delete sbv[f];
                    if (v === 'asc' || v === 'desc') sort[f] = v;
                    else sbv[f] = v === 'vdesc' ? 'desc' : 'asc';
                    set({ sort, sortByValue: sbv });
                  }}
                >
                  <option value="asc">A→Z</option>
                  <option value="desc">Z→A</option>
                  <option value="vdesc">Largest first</option>
                  <option value="vasc">Smallest first</option>
                </select>,
              ),
            )}
          </ul>
        </div>
        <div>
          <strong>Columns</strong>
          <ul className="chips">
            {cfg.cols.map((f, i) =>
              chip(
                f,
                i,
                cfg.cols,
                (a) => set({ cols: a }),
                <select
                  aria-label={`Sort ${f}`}
                  value={cfg.sort?.[f] ?? 'asc'}
                  onChange={(e) => set({ sort: { ...(cfg.sort ?? {}), [f]: e.target.value as 'asc' | 'desc' } })}
                >
                  <option value="asc">A→Z</option>
                  <option value="desc">Z→A</option>
                </select>,
              ),
            )}
          </ul>
        </div>
      </div>
      <div>
        <strong>Values</strong>
        <ul className="chips vals">
          {cfg.values.map((v, i) =>
            chip(
              v.field,
              i,
              cfg.values,
              (a) => set({ values: a as ValueField[] }),
              <>
                <select
                  aria-label={`Summarize ${v.field} by`}
                  value={v.agg}
                  onChange={(e) => setVal(i, { agg: e.target.value as Agg })}
                >
                  {(Object.keys(AGG_LABEL) as Agg[]).map((a) => (
                    <option key={a} value={a}>
                      {AGG_LABEL[a]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Show ${v.field} as`}
                  value={v.as ?? 'normal'}
                  onChange={(e) => setVal(i, { as: e.target.value as ShowAs })}
                >
                  {(Object.keys(SHOW_AS_LABEL) as ShowAs[]).map((a) => (
                    <option key={a} value={a}>
                      {SHOW_AS_LABEL[a]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Number format ${v.field}`}
                  value={v.fmt ?? 'general'}
                  onChange={(e) => setVal(i, { fmt: e.target.value as ValueField['fmt'] })}
                >
                  <option value="general">General</option>
                  <option value="number">Number</option>
                  <option value="currency">Currency</option>
                  <option value="percent">Percent</option>
                </select>
                <input
                  aria-label={`Custom name ${v.field}`}
                  placeholder="custom name"
                  value={v.name ?? ''}
                  onChange={(e) => setVal(i, { name: e.target.value })}
                />
              </>,
            ),
          )}
        </ul>
      </div>
      <div>
        <strong>Report filters</strong>
        {cfg.filters.map((f, i) => (
          <FilterBox
            key={f.field}
            engine={engine}
            def={def}
            cfg={cfg}
            f={f}
            onChange={(ex) => set({ filters: cfg.filters.map((x, k) => (k === i ? { ...x, exclude: ex } : x)) })}
            onRemove={() => set({ filters: cfg.filters.filter((_, k) => k !== i) })}
          />
        ))}
      </div>
      <details>
        <summary>
          <strong>Layout, totals and options</strong>
        </summary>
        <div className="grid2">
          <Field label="Report layout">
            <select value={cfg.layout} onChange={(e) => set({ layout: e.target.value as PivotConfig['layout'] })}>
              <option value="compact">Compact</option>
              <option value="outline">Outline</option>
              <option value="tabular">Tabular</option>
            </select>
          </Field>
          <Field label="For empty cells show">
            <input value={cfg.emptyText ?? ''} onChange={(e) => set({ emptyText: e.target.value || undefined })} />
          </Field>
        </div>
        <div className="checks">
          <Check label="Subtotals" checked={cfg.subtotals} onChange={(v) => set({ subtotals: v })} />
          <Check
            label="Grand total for columns (bottom row)"
            checked={cfg.grandCols}
            onChange={(v) => set({ grandCols: v })}
          />
          <Check
            label="Grand total for rows (right column)"
            checked={cfg.grandRows}
            onChange={(v) => set({ grandRows: v })}
          />
        </div>
        <div className="grid2">
          <Field label="Top / bottom N on first row field">
            <select
              value={cfg.top ? cfg.top.dir : ''}
              onChange={(e) =>
                set({
                  top:
                    e.target.value && cfg.rows[0]
                      ? { field: cfg.rows[0], n: cfg.top?.n ?? 10, dir: e.target.value as 'top' | 'bottom' }
                      : null,
                })
              }
            >
              <option value="">Show all</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
          {cfg.top && (
            <Field label="N">
              <input
                type="number"
                min={1}
                value={cfg.top.n}
                onChange={(e) => set({ top: { ...cfg.top!, n: Math.max(1, +e.target.value || 1) } })}
              />
            </Field>
          )}
        </div>
      </details>
      <details>
        <summary>
          <strong>
            Grouping (dates are grouped automatically as “… (Years/Quarters/Months)” fields; numbers here)
          </strong>
        </summary>
        <div className="grid2">
          <Field label="Group numeric field">
            <select value={binF} onChange={(e) => setBinF(e.target.value)}>
              <option value="">—</option>
              {(info?.fields ?? [])
                .filter((f) => !dateFlds.includes(f) && !/\((Years|Quarters|Months)\)/.test(f))
                .map((f) => (
                  <option key={f}>{f}</option>
                ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Starting at">
              <input type="number" value={binS} onChange={(e) => setBinS(e.target.value)} />
            </Field>
            <Field label="By">
              <input type="number" min={1} value={binW} onChange={(e) => setBinW(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="row-btns">
          <button
            disabled={!binF || !(+binW > 0)}
            onClick={() => set({ bins: { ...(cfg.bins ?? {}), [binF]: { start: +binS || 0, step: +binW } } })}
          >
            Group
          </button>
          {Object.keys(cfg.bins ?? {}).map((f) => (
            <button
              key={f}
              onClick={() => {
                const b = { ...(cfg.bins ?? {}) };
                delete b[f];
                set({ bins: b });
              }}
            >
              Ungroup {f} ({cfg.bins![f].start}, +{cfg.bins![f].step})
            </button>
          ))}
        </div>
      </details>
      <details>
        <summary>
          <strong>Calculated fields</strong>
        </summary>
        <div className="grid2">
          <Field label="Name">
            <input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="Profit" />
          </Field>
          <Field label="Formula (field names, + − * / ^ and parentheses)">
            <input value={cf} onChange={(e) => setCf(e.target.value)} placeholder="Sales - Cost" />
          </Field>
        </div>
        <div className="row-btns">
          <button
            disabled={!cn.trim() || !cf.trim()}
            onClick={() => {
              set({
                calc: [
                  ...(cfg.calc ?? []).filter((c) => c.name !== cn.trim()),
                  { name: cn.trim(), formula: cf.trim() },
                ],
              });
              setCn('');
              setCf('');
            }}
          >
            Add field
          </button>
          {(cfg.calc ?? []).map((c) => (
            <button
              key={c.name}
              onClick={() =>
                set({
                  calc: cfg.calc!.filter((x) => x.name !== c.name),
                  values: cfg.values.filter((v) => v.field !== c.name),
                })
              }
            >
              Remove {c.name} = {c.formula}
            </button>
          ))}
        </div>
      </details>
      <div className="row-btns">
        <button className="primary" onClick={apply}>
          Update PivotTable
        </button>
        <button
          onClick={() => {
            const o = updatePivot(engine, def.id, {});
            setR(o);
            onChange();
          }}
        >
          Refresh
        </button>
        <button
          onClick={() =>
            setR(goTo(engine, `${def.destSheet.includes(' ') ? `'${def.destSheet}'` : def.destSheet}!${def.anchor}`))
          }
        >
          Go to PivotTable
        </button>
        <button
          onClick={() => {
            setR(removePivot(engine, def.id));
            onDeleted();
          }}
        >
          Delete
        </button>
      </div>
      <Result r={r} />
      <h3>Slicers and timelines</h3>
      <div className="grid2" style={{ alignItems: 'end' }}>
        <Field label="Field">
          <select value={wf} onChange={(e) => setWf(e.target.value)}>
            <option value="">—</option>
            {(info?.fields ?? []).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <div className="row-btns">
          <button
            disabled={!wf}
            onClick={() => {
              setR(addSlicer(engine, def.id, wf, 'slicer'));
              onChange();
            }}
          >
            Insert slicer
          </button>
          <button
            disabled={!wf || !dateFlds.includes(wf)}
            title={dateFlds.includes(wf) ? '' : 'Pick a date field'}
            onClick={() => {
              setR(addSlicer(engine, def.id, wf, 'timeline'));
              onChange();
            }}
          >
            Insert timeline
          </button>
        </div>
      </div>
      <ul className="chips">
        {def.widgets.map((w) => (
          <li key={w.id} className="chip">
            <span>
              {w.kind}: {w.field}
            </span>
            <button
              aria-label={`Remove ${w.kind} ${w.field}`}
              onClick={() => {
                setR(removeWidget(engine, def.id, w.id));
                onChange();
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <h3>PivotChart</h3>
      <div className="grid2" style={{ alignItems: 'end' }}>
        <Field label="Chart type">
          <select value={ct} onChange={(e) => setCt(e.target.value as ChartType)}>
            {CHART_TYPES.filter(
              ([t]) => !['scatter', 'bubble', 'stock', 'histogram', 'box', 'surface', 'surface3d'].includes(t),
            ).map(([t, l]) => (
              <option key={t} value={t}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <div className="row-btns">
          <button
            onClick={() => {
              setR(createPivotChart(engine, def.id, ct));
              onChange();
            }}
          >
            Insert PivotChart
          </button>
        </div>
      </div>
    </div>
  );
}

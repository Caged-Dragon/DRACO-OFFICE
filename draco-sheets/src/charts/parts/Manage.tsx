import { useEffect, useState } from 'react';
import type { Engine } from '../../core/engine';
import { renderChart, type ChartOpts, type ChartType } from '../render';
import { listCharts, removeChart, updateChart, type ChartInfo } from '../chartGlue';
import { type Out } from '../../data/dataGlue';
import { FormBody } from './FormBody';
import { Insert } from './Insert';
import { CHART_TYPES, Field, Form, Result, SAMPLE, num } from './shared';

export function Manage({ engine }: { engine: Engine }) {
  const [mv, setMv] = useState('');
  const [list, setList] = useState<ChartInfo[]>(() => listCharts(engine));
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [r, setR] = useState<Out | null>(null);
  const refresh = () => setList(listCharts(engine));
  useEffect(() => {
    if (!sel) {
      setF(null);
      return;
    }
    const c = list.find((x) => x.id === sel);
    const wb = engine.api.getActiveWorkbook();
    if (!c || !wb) return;
    for (const ws of wb.getSheets()) {
      const d = ws.getFloatDomById(sel);
      if (d?.data) {
        const x = d.data as unknown as {
          type: ChartType;
          title: string;
          byRows: boolean;
          opts: ChartOpts;
          range: string;
          sheet: string;
        };
        setF({
          type: x.type,
          range: `${x.sheet}!${x.range}`,
          title: x.title,
          byRows: x.byRows,
          opts: x.opts,
          w: c.w,
          h: c.h,
        });
        break;
      }
    }
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return <p className="hint">No charts yet. Select your data and use “Insert chart”.</p>;
  return (
    <>
      <ul className="chart-list">
        {list.map((c) => (
          <li key={c.id}>
            <button className={sel === c.id ? 'on' : ''} onClick={() => setSel(c.id)}>
              {c.title || `${c.type} chart`}{' '}
              <small>
                · {c.sheet}!{c.range}
              </small>
            </button>
          </li>
        ))}
      </ul>
      {f && sel && (
        <>
          <div className="chart-types">
            {CHART_TYPES.map(([t, l]) => (
              <button
                key={t}
                role="radio"
                aria-checked={f.type === t}
                className={'ctype' + (f.type === t ? ' on' : '')}
                onClick={() => setF({ ...f, type: t })}
                title={l}
              >
                <span dangerouslySetInnerHTML={{ __html: renderChart(SAMPLE[t], 96, 62) }} />
                <small>{l}</small>
              </button>
            ))}
          </div>
          <FormBody engine={engine} f={f} setF={setF} />
          <div className="grid2">
            <Field label="Width (px)">
              <input
                type="number"
                min={160}
                value={f.w ?? ''}
                onChange={(e) => setF({ ...f, w: num(e.target.value) })}
              />
            </Field>
            <Field label="Height (px)">
              <input
                type="number"
                min={120}
                value={f.h ?? ''}
                onChange={(e) => setF({ ...f, h: num(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Move to cell (top-left corner)">
            <input value={mv} onChange={(e) => setMv(e.target.value)} placeholder="e.g. H10 (blank = keep)" />
          </Field>
          <div className="row-btns">
            <button
              className="primary"
              onClick={() => {
                const rng = f.range.includes('!') ? f.range.slice(f.range.lastIndexOf('!') + 1) : f.range;
                setR(
                  updateChart(engine, sel, {
                    type: f.type,
                    title: f.title,
                    byRows: f.byRows,
                    range: rng,
                    opts: f.opts,
                    w: f.w,
                    h: f.h,
                    at: mv || undefined,
                  }),
                );
                setMv('');
                refresh();
              }}
            >
              Apply changes
            </button>
            <button
              onClick={() => {
                setR(removeChart(engine, sel));
                setSel(null);
                refresh();
              }}
            >
              Delete chart
            </button>
          </div>
        </>
      )}
      <Result r={r} />
    </>
  );
}

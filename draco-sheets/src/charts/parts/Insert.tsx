import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { renderChart } from '../render';
import { chartDefault, createChart } from '../chartGlue';
import { type Out } from '../../data/dataGlue';
import { FormBody } from './FormBody';
import { CHART_TYPES, Form, Result, SAMPLE } from './shared';

export function Insert({ engine, onDone }: { engine: Engine; onDone: () => void }) {
  const def = useMemo(() => chartDefault(engine), [engine]);
  const [f, setF] = useState<Form>({
    type: 'column',
    range: def
      ? def.sheet === engine.api.getActiveWorkbook()?.getActiveSheet().getSheetName()
        ? def.range
        : `${def.sheet}!${def.range}`
      : '',
    title: '',
    byRows: false,
    opts: { legend: 'bottom', grid: true },
  });
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="chart-types" role="radiogroup" aria-label="Chart type">
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
      <div className="row-btns">
        <button
          className="primary"
          onClick={() => {
            const o = createChart(engine, {
              range: f.range,
              type: f.type,
              title: f.title,
              byRows: f.byRows,
              opts: f.opts,
            });
            setR(o);
            if (o.ok) setTimeout(onDone, 500);
          }}
        >
          Insert chart
        </button>
      </div>
      <Result r={r} />
    </>
  );
}

import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { chartDefault } from '../../charts/chartGlue';
import { type Out } from '../../data/dataGlue';
import { createPivot } from '../pivotGlue';
import { Field, Result } from './shared';

export function NewPivot({ engine, onCreated }: { engine: Engine; onCreated: (id: string, o: Out) => void }) {
  const dflt = useMemo(() => chartDefault(engine), [engine]);
  const wbSheet = engine.api.getActiveWorkbook()?.getActiveSheet().getSheetName();
  const [src, setSrc] = useState(dflt ? (dflt.sheet === wbSheet ? dflt.range : `${dflt.sheet}!${dflt.range}`) : '');
  const [dest, setDest] = useState('');
  const [name, setName] = useState('');
  const [r, setR] = useState<Out | null>(null);
  return (
    <div className="stack">
      <p className="hint">
        Select your data (with a header row) and create the PivotTable, then drag fields into Rows, Columns, Values and
        Filters.
      </p>
      <Field label="Table / range">
        <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="e.g. A1:E200 or Sheet2!A1:E200" />
      </Field>
      <div className="grid2">
        <Field label="Place PivotTable at (first cell)">
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="blank = to the right of the data"
          />
        </Field>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PivotTable1" />
        </Field>
      </div>
      <div className="row-btns">
        <button
          className="primary"
          onClick={() => {
            const o = createPivot(engine, { name, src, dest: dest || undefined });
            setR(o);
            if (o.ok && o.id) onCreated(o.id, o);
          }}
        >
          Create PivotTable
        </button>
      </div>
      <Result r={r} />
    </div>
  );
}

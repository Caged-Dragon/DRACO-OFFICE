import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { chartDefault } from '../../charts/chartGlue';
import { addCamera } from '../objectGlue';
import { type Out } from '../../data/dataGlue';
import { Field, Result } from './shared';

export function Camera({ engine }: { engine: Engine }) {
  const def = useMemo(() => chartDefault(engine), [engine]);
  const [rg, setRg] = useState(def?.range ?? '');
  const [r, setR] = useState<Out | null>(null);
  return (
    <div className="stack">
      <p className="hint">
        A linked picture is a live snapshot of a cell range: it keeps updating as the cells change (values, fills, bold,
        alignment).
      </p>
      <Field label="Range to photograph">
        <input value={rg} onChange={(e) => setRg(e.target.value)} placeholder="e.g. A1:D8" />
      </Field>
      <div className="row-btns">
        <button className="primary" onClick={() => setR(addCamera(engine, rg))}>
          Insert linked picture
        </button>
      </div>
      <Result r={r} />
    </div>
  );
}

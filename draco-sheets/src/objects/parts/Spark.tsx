import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { chartDefault } from '../../charts/chartGlue';
import { renderSparkline, type SparkOpts } from '../spark';
import { clearSparklines, createSparklines, setSparkOpts } from '../objectGlue';
import { parseRef, readValues, type Out } from '../../data/dataGlue';
import { Check, Field, Result, Svg } from './shared';

export function Spark({ engine }: { engine: Engine }) {
  const def = useMemo(() => chartDefault(engine), [engine]);
  const [src, setSrc] = useState(def?.range ?? '');
  const [loc, setLoc] = useState('');
  const [byCol, setByCol] = useState(false);
  const [o, setO] = useState<SparkOpts>({ kind: 'line', color: '#4472C4', markers: false });
  const [r, setR] = useState<Out | null>(null);
  const sample = useMemo(() => {
    try {
      const l = src ? parseRef(engine, src) : null;
      if (!l) return [3, 6, 4, 9, 5, 8];
      const g = readValues(l);
      const row = byCol ? g.map((x) => x[0]) : g[0];
      return (row ?? []).map((v) => (typeof v === 'number' ? v : null));
    } catch {
      return [3, 6, 4, 9, 5, 8];
    }
  }, [engine, src, byCol]);
  const set = (p: Partial<SparkOpts>) => setO({ ...o, ...p });
  return (
    <div className="stack">
      <p className="hint">
        One sparkline is made for each row (or column) of the data range and placed in the location cells.
      </p>
      <div className="grid2">
        <Field label="Data range">
          <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="e.g. B2:G6" />
        </Field>
        <Field label="Location (first cell)">
          <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. H2" />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Type">
          <select value={o.kind} onChange={(e) => set({ kind: e.target.value as SparkOpts['kind'] })}>
            <option value="line">Line</option>
            <option value="column">Column</option>
            <option value="winloss">Win / Loss</option>
          </select>
        </Field>
        <Field label="Color">
          <input type="color" value={o.color ?? '#4472C4'} onChange={(e) => set({ color: e.target.value })} />
        </Field>
      </div>
      <div className="checks">
        <Check label="One per column" checked={byCol} onChange={setByCol} />
        {o.kind === 'line' && <Check label="Markers" checked={!!o.markers} onChange={(v) => set({ markers: v })} />}
        <Check label="High point" checked={!!o.high} onChange={(v) => set({ high: v })} />
        <Check label="Low point" checked={!!o.low} onChange={(v) => set({ low: v })} />
        <Check label="First point" checked={!!o.first} onChange={(v) => set({ first: v })} />
        <Check label="Last point" checked={!!o.last} onChange={(v) => set({ last: v })} />
        <Check label="Negative points" checked={!!o.negative} onChange={(v) => set({ negative: v })} />
        <Check label="Show axis" checked={!!o.axis} onChange={(v) => set({ axis: v })} />
        <Check
          label="Empty cells as zero"
          checked={o.emptyAs === 'zero'}
          onChange={(v) => set({ emptyAs: v ? 'zero' : 'gap' })}
        />
      </div>
      <Svg html={renderSparkline(sample, o, 220, 44)} label="Sparkline preview" />
      <div className="row-btns">
        <button
          className="primary"
          onClick={() => setR(createSparklines(engine, { src, loc, opts: o, byColumn: byCol }))}
        >
          Insert sparklines
        </button>
        <button onClick={() => setR(setSparkOpts(engine, loc, o))} disabled={!loc}>
          Apply style to sparkline at location
        </button>
        <button onClick={() => setR(clearSparklines(engine, 'selection'))}>Clear in selection</button>
        <button onClick={() => setR(clearSparklines(engine, 'sheet'))}>Clear on sheet</button>
      </div>
      <Result r={r} />
    </div>
  );
}

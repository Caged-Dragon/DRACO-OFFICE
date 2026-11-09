import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { textToColumnsRun, type Out } from '../dataGlue';
import { Check, Field, Result } from './shared';

export function TextCols({ engine }: { engine: Engine }) {
  const [d, setD] = useState(',');
  const [custom, setCustom] = useState('');
  const [merge, setMerge] = useState(false);
  const [q, setQ] = useState('"');
  const [ow, setOw] = useState(false);
  const [r, setR] = useState<Out | null>(null);
  const delim = d === 'custom' ? custom : d === 'tab' ? '\t' : d;
  return (
    <>
      <p className="hint">Select one column of cells, then split each into columns to the right.</p>
      <div className="stack">
        <Field label="Delimiter">
          <select value={d} onChange={(e) => setD(e.target.value)}>
            <option value=",">Comma</option>
            <option value=";">Semicolon</option>
            <option value="tab">Tab</option>
            <option value=" ">Space</option>
            <option value="|">Pipe</option>
            <option value="custom">Other…</option>
          </select>
        </Field>
        {d === 'custom' && (
          <Field label="Other delimiter">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={5} />
          </Field>
        )}
        <Field label="Text qualifier">
          <select value={q} onChange={(e) => setQ(e.target.value)}>
            <option value={'"'}>Double quote (")</option>
            <option value="'">Single quote (')</option>
            <option value="">None</option>
          </select>
        </Field>
        <Check label="Treat consecutive delimiters as one" checked={merge} onChange={setMerge} />
        <Check label="Overwrite existing data on the right" checked={ow} onChange={setOw} />
        <div className="row-btns">
          <button className="primary" onClick={() => setR(textToColumnsRun(engine, delim, merge, q, ow))}>
            Split
          </button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

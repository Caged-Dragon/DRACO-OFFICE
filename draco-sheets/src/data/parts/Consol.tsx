import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { type ConsFn } from '../dataTools';
import { consolidateRun, type Out } from '../dataGlue';
import { Field, Result } from './shared';

export function Consol({ engine }: { engine: Engine }) {
  const [refs, setRefs] = useState('');
  const [fn, setFn] = useState<ConsFn>('sum');
  const [mode, setMode] = useState<'position' | 'labels'>('labels');
  const [dest, setDest] = useState('');
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">
        One source range per line, e.g. <code>Sheet1!A1:C5</code>. “By labels” matches the first row and first column
        text across sources.
      </p>
      <div className="stack">
        <Field label="Source ranges">
          <textarea
            rows={4}
            value={refs}
            onChange={(e) => setRefs(e.target.value)}
            placeholder={'Sheet1!A1:C5\nSheet2!A1:C5'}
          />
        </Field>
        <Field label="Function">
          <select value={fn} onChange={(e) => setFn(e.target.value as ConsFn)}>
            {(['sum', 'average', 'count', 'max', 'min', 'product'] as ConsFn[]).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Combine">
          <select value={mode} onChange={(e) => setMode(e.target.value as 'position' | 'labels')}>
            <option value="labels">By labels (top row + left column)</option>
            <option value="position">By position</option>
          </select>
        </Field>
        <Field label="Destination (top-left cell)">
          <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="H1" />
        </Field>
        <div className="row-btns">
          <button className="primary" onClick={() => setR(consolidateRun(engine, refs.split('\n'), fn, mode, dest))}>
            Consolidate
          </button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

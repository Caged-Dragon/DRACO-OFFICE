import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { advancedFilterReset, advancedFilterRun, colName, selectionLoc, type Out } from '../dataGlue';
import { Check, Field, Result } from './shared';

export function Adv({ engine }: { engine: Engine }) {
  const sel = selectionLoc(engine);
  const [list, setList] = useState(
    sel && sel.rows * sel.cols > 1
      ? `${colName(sel.c0)}${sel.r0 + 1}:${colName(sel.c0 + sel.cols - 1)}${sel.r0 + sel.rows}`
      : '',
  );
  const [crit, setCrit] = useState('');
  const [act, setAct] = useState<'inplace' | 'copy'>('inplace');
  const [dest, setDest] = useState('');
  const [uniq, setUniq] = useState(false);
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">
        Criteria range: header row (matching your column names) plus criteria rows. Cells in a row are AND, rows are OR.
        Operators: <code>&gt;40</code>, <code>&lt;=30</code>, <code>&lt;&gt;x</code>, <code>=text</code>, wildcards{' '}
        <code>*</code> <code>?</code>.
      </p>
      <div className="stack">
        <Field label="List range (with headers)">
          <input value={list} onChange={(e) => setList(e.target.value)} placeholder="A1:D50" />
        </Field>
        <Field label="Criteria range (with headers)">
          <input value={crit} onChange={(e) => setCrit(e.target.value)} placeholder="F1:G3" />
        </Field>
        <Field label="Action">
          <select value={act} onChange={(e) => setAct(e.target.value as 'inplace' | 'copy')}>
            <option value="inplace">Filter the list, in place</option>
            <option value="copy">Copy to another location</option>
          </select>
        </Field>
        {act === 'copy' && (
          <Field label="Copy to">
            <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="I1" />
          </Field>
        )}
        <Check label="Unique records only" checked={uniq} onChange={setUniq} />
        <div className="row-btns">
          <button className="primary" onClick={() => setR(advancedFilterRun(engine, list, crit, act, dest, uniq))}>
            Apply filter
          </button>
          <button onClick={() => setR(advancedFilterReset(engine, list))}>Show all rows</button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

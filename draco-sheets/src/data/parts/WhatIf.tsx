import { useState } from 'react';
import type { Engine } from '../../core/engine';
import {
  dataTableRun,
  goalSeekRun,
  loadScenarios,
  scenarioDelete,
  scenarioSave,
  scenarioShow,
  type Out,
} from '../dataGlue';
import { Field, Result } from './shared';

export function WhatIf({ engine }: { engine: Engine }) {
  const [setC, setSetC] = useState('');
  const [to, setTo] = useState('');
  const [by, setBy] = useState('');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Out | null>(null);
  const [dIn, setDIn] = useState('');
  const [dF, setDF] = useState('');
  const [sn, setSn] = useState('');
  const [sc, setSc] = useState('');
  const [scs, setScs] = useState(() => loadScenarios(engine));
  const run = async (f: () => Promise<Out>) => {
    setBusy(true);
    try {
      setR(await f());
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h3>Goal Seek</h3>
      <div className="stack">
        <Field label="Set cell (contains a formula)">
          <input value={setC} onChange={(e) => setSetC(e.target.value)} placeholder="B5" />
        </Field>
        <Field label="To value">
          <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="decimal" placeholder="200" />
        </Field>
        <Field label="By changing cell (contains a value)">
          <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="B2" />
        </Field>
        <div className="row-btns">
          <button
            className="primary"
            disabled={busy}
            onClick={() => run(() => goalSeekRun(engine, setC, Number(to), by))}
          >
            {busy ? 'Working…' : 'Solve'}
          </button>
        </div>
      </div>
      <h3>Data table (one variable)</h3>
      <p className="hint">
        Select a column of input values, then name the input cell and the formula cell. Results fill the next column.
      </p>
      <div className="stack">
        <Field label="Column input cell">
          <input value={dIn} onChange={(e) => setDIn(e.target.value)} placeholder="B2" />
        </Field>
        <Field label="Formula cell">
          <input value={dF} onChange={(e) => setDF(e.target.value)} placeholder="B5" />
        </Field>
        <div className="row-btns">
          <button disabled={busy} onClick={() => run(() => dataTableRun(engine, dIn, dF))}>
            Fill data table
          </button>
        </div>
      </div>
      <h3>Scenarios</h3>
      <div className="stack">
        <Field label="Scenario name">
          <input value={sn} onChange={(e) => setSn(e.target.value)} />
        </Field>
        <Field label="Changing cells (current values are saved)">
          <input value={sc} onChange={(e) => setSc(e.target.value)} placeholder="B1, B2, B3" />
        </Field>
        <div className="row-btns">
          <button
            onClick={() => {
              const o = scenarioSave(engine, sn, sc);
              setR(o);
              setScs(loadScenarios(engine));
            }}
          >
            Save scenario
          </button>
        </div>
      </div>
      {scs.length > 0 && (
        <ul className="filelist">
          {scs.map((s) => (
            <li key={s.name}>
              <button className="row" onClick={() => run(() => scenarioShow(engine, s.name))}>
                <span className="name">{s.name}</span>
                <span className="meta">
                  {Object.entries(s.cells)
                    .map(([k, v]) => `${k.split('!')[1]}=${v}`)
                    .join(', ')}
                </span>
              </button>
              <button
                className="icon"
                aria-label={`Delete scenario ${s.name}`}
                onClick={() => {
                  setR(scenarioDelete(engine, s.name));
                  setScs(loadScenarios(engine));
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
      <Result r={r} />
    </>
  );
}

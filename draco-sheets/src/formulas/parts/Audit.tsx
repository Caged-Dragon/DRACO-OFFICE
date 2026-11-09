import * as traceGlue from '../../trace/traceGlue';
import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { a1, dependents, precedents, rectLabel } from '../audit';
import { activeCell, collectFormulas, nameMap } from '../formulaTools';

export function Audit({ engine, jump }: { engine: Engine; jump: (s: string, r: number, c: number) => void }) {
  const cell = useMemo(() => activeCell(engine), [engine]);
  const [deep, setDeep] = useState(false);
  const all = useMemo(() => collectFormulas(engine), [engine]);
  const names = useMemo(() => nameMap(engine), [engine]);
  const [mode, setMode] = useState<'pre' | 'dep' | 'list'>('pre');
  const [arrowMsg, setArrowMsg] = useState('');
  if (!cell) return <p>Select a cell first.</p>;
  const label = `${cell.sheet}!${a1(cell.row, cell.col)}`;
  const pre = mode === 'pre' ? precedents(cell, all, names, deep) : [];
  const dep = mode === 'dep' ? dependents(cell, all, names, deep) : [];
  return (
    <>
      <p className="hint">
        Active cell: <b>{label}</b>{' '}
        {all.find((f) => f.sheet === cell.sheet && f.row === cell.row && f.col === cell.col)?.formula ?? '(no formula)'}
      </p>
      <div className="row-btns">
        <button className={mode === 'pre' ? 'primary' : ''} onClick={() => setMode('pre')}>
          Trace precedents
        </button>
        <button className={mode === 'dep' ? 'primary' : ''} onClick={() => setMode('dep')}>
          Trace dependents
        </button>
        <button className={mode === 'list' ? 'primary' : ''} onClick={() => setMode('list')}>
          All formulas
        </button>
        {mode !== 'list' && (
          <button
            aria-label="Draw arrows on sheet"
            onClick={() =>
              setArrowMsg(traceGlue.trace(engine, mode === 'pre' ? 'precedents' : 'dependents', deep).message)
            }
          >
            Draw arrows on sheet
          </button>
        )}
        <button
          aria-label="Remove arrows"
          onClick={() => {
            traceGlue.clear(engine);
            setArrowMsg('Arrows removed.');
          }}
        >
          Remove arrows
        </button>
        {mode !== 'list' && (
          <label className="inline">
            <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> All levels
          </label>
        )}
      </div>
      {arrowMsg && (
        <p className="hint" role="status">
          {arrowMsg}
        </p>
      )}
      <ul className="filelist">
        {mode === 'pre' &&
          (pre.length === 0 ? (
            <li className="hint">This cell has no precedents.</li>
          ) : (
            pre.map((r, i) => (
              <li key={i}>
                <button className="row" onClick={() => jump(r.sheet ?? cell.sheet, r.r1, r.c1)}>
                  <span className="name">{rectLabel(r, cell.sheet)}</span>
                  <span className="meta">{r.sheet}</span>
                </button>
              </li>
            ))
          ))}
        {mode === 'dep' &&
          (dep.length === 0 ? (
            <li className="hint">No cells depend on this cell.</li>
          ) : (
            dep.map((f, i) => (
              <li key={i}>
                <button className="row" onClick={() => jump(f.sheet, f.row, f.col)}>
                  <span className="name">
                    {f.sheet}!{a1(f.row, f.col)}
                  </span>
                  <span className="meta">{f.formula}</span>
                </button>
              </li>
            ))
          ))}
        {mode === 'list' &&
          (all.length === 0 ? (
            <li className="hint">No formulas in this workbook.</li>
          ) : (
            all.slice(0, 500).map((f, i) => (
              <li key={i}>
                <button className="row" onClick={() => jump(f.sheet, f.row, f.col)}>
                  <span className="name">
                    {f.sheet}!{a1(f.row, f.col)}
                  </span>
                  <span className="meta">{f.formula}</span>
                </button>
              </li>
            ))
          ))}
      </ul>
    </>
  );
}

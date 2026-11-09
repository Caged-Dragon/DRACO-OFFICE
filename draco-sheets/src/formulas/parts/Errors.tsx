import * as traceGlue from '../../trace/traceGlue';
import { useEffect, useState } from 'react';
import type { Engine } from '../../core/engine';
import { a1 } from '../audit';
import { circularCells, collectErrors, type ErrorCell } from '../formulaTools';

export function Errors({ engine, jump }: { engine: Engine; jump: (s: string, r: number, c: number) => void }) {
  const [errs, setErrs] = useState<ErrorCell[] | null>(null);
  const [circ, setCirc] = useState<{
    cells: { sheet: string; row: number; col: number; formula: string }[];
    skipped: boolean;
  }>({ cells: [], skipped: false });
  const [dvMsg, setDvMsg] = useState('');
  const scan = () => {
    setErrs(collectErrors(engine));
    setCirc(circularCells(engine));
  };
  useEffect(scan, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="row-btns">
        <button className="primary" onClick={scan}>
          Scan workbook
        </button>
        <button
          aria-label="Circle invalid data"
          onClick={async () => setDvMsg((await traceGlue.circleInvalid(engine)).message)}
        >
          Circle invalid data
        </button>
        <button
          aria-label="Clear validation circles"
          onClick={() => {
            traceGlue.clearCircles(engine);
            setDvMsg('Circles cleared.');
          }}
        >
          Clear circles
        </button>
      </div>
      {dvMsg && (
        <p className="hint" role="status">
          {dvMsg}
        </p>
      )}
      {circ.cells.length > 0 && (
        <>
          <h3 role="alert">⚠ Circular references ({circ.cells.length}) — these cells evaluate to 0</h3>
          <ul className="filelist">
            {circ.cells.map((x, i) => (
              <li key={i}>
                <button className="row" onClick={() => jump(x.sheet, x.row, x.col)}>
                  <span className="name">
                    {x.sheet}!{a1(x.row, x.col)}
                  </span>
                  <span className="meta">{x.formula}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {circ.skipped && <p className="hint">Circular-reference check skipped (more than 5,000 formulas).</p>}
      {errs === null ? (
        <p>Scanning…</p>
      ) : errs.length === 0 ? (
        <p className="hint">
          ✔ No error values found in any sheet.
          {circ.cells.length === 0 && !circ.skipped ? ' No circular references.' : ''}
        </p>
      ) : (
        <ul className="filelist">
          {errs.map((x, i) => (
            <li key={i}>
              <button className="row" onClick={() => jump(x.sheet, x.row, x.col)}>
                <span className="name">
                  {x.sheet}!{a1(x.row, x.col)} — {x.value}
                </span>
                <span className="meta">{x.formula || 'typed value'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

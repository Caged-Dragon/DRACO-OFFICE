import { useMemo, useState } from 'react';
import type { Engine } from '../core/engine';
import { activeCell, cellInfo } from './formulaTools';
import { evaluateSteps, type Val } from './evalSteps';

const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const parseRef = (r: string) => {
  const m = /^([A-Z]+)(\d+)$/.exec(r);
  return m ? { c: colNum(m[1]), r: +m[2] - 1 } : { c: 0, r: 0 };
};
const asVal = (v: string): Val =>
  v === ''
    ? 0
    : v === 'TRUE'
      ? true
      : v === 'FALSE'
        ? false
        : v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, '')))
          ? Number(v.replace(/,/g, ''))
          : v;

/** Evaluate Formula — steps through the active cell's formula, one reduction per click. */
export default function EvaluateTab({ engine }: { engine: Engine }) {
  const cur = useMemo(() => activeCell(engine), [engine]);
  const info = cur ? cellInfo(engine, cur.sheet, cur.row, cur.col) : null;
  const steps = useMemo(() => {
    if (!cur || !info?.formula) return [];
    const look = {
      cell: (r: string) => {
        const p = parseRef(r);
        return asVal(cellInfo(engine, cur.sheet, p.r, p.c).value);
      },
      range: (r: string) => {
        const [a, b] = r.split(':').map(parseRef);
        const out: Val[] = [];
        for (let y = Math.min(a.r, b.r); y <= Math.max(a.r, b.r); y++)
          for (let x = Math.min(a.c, b.c); x <= Math.max(a.c, b.c); x++)
            out.push(asVal(cellInfo(engine, cur.sheet, y, x).value));
        return out;
      },
    };
    return evaluateSteps(info.formula, look);
  }, [engine, cur, info?.formula]);
  const [i, setI] = useState(0);
  if (!cur || !info?.formula)
    return <p className="hint">Select a cell that contains a formula, then reopen Evaluate formula.</p>;
  const step = steps[Math.min(i, steps.length - 1)];
  const parts = step.text.split(/[␂␃]/);
  const done = i >= steps.length - 1;
  return (
    <div className="eval">
      <p className="hint">
        Cell {cur.sheet}!{String.fromCharCode(65 + (cur.col % 26))}
        {cur.row + 1}: <code>{info.formula}</code>
      </p>
      <div className="eval-box" role="status" aria-label="Evaluation">
        <code>={parts.map((p, k) => (k % 2 === 1 ? <u key={k}>{p}</u> : <span key={k}>{p}</span>))}</code>
      </div>
      <div className="row-btns">
        <button className="primary" disabled={done} onClick={() => setI((n) => n + 1)}>
          Evaluate
        </button>
        <button onClick={() => setI(0)}>Restart</button>
        <button disabled={done} onClick={() => setI(steps.length - 1)}>
          Show result
        </button>
        <span className="hint">
          Step {Math.min(i, steps.length - 1) + 1} of {steps.length}
        </span>
      </div>
      <p className="hint">
        Cell shows <b>{info.value}</b>
      </p>
    </div>
  );
}

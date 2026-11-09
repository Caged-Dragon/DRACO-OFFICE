import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { colName, removeSubtotalsRun, subtotalRun, targetLoc, readDisplay, type Out } from '../dataGlue';
import { Check, Field, Result } from './shared';

export function Subtotal({ engine }: { engine: Engine }) {
  const loc = useMemo(() => targetLoc(engine), [engine]);
  const heads = useMemo(
    () =>
      loc
        ? (readDisplay({ ...loc, rng: loc.sheet.getRange(loc.r0, loc.c0, 1, loc.cols) }) as unknown[][])[0].map(
            (h, i) => (h ? String(h) : `Column ${colName(loc.c0 + i)}`),
          )
        : [],
    [loc],
  );
  const [g, setG] = useState(0);
  const [fn, setFn] = useState<9 | 1 | 2 | 4 | 5 | 6>(9);
  const [sum, setSum] = useState<Record<number, boolean>>({});
  const [r, setR] = useState<Out | null>(null);
  if (!loc) return <p>Select the data range (with a header row) first.</p>;
  return (
    <>
      <p className="hint">
        Sort the data by the group column first. A subtotal row is inserted after each change in that column, plus a
        grand total.
      </p>
      <div className="stack">
        <Field label="At each change in">
          <select value={g} onChange={(e) => setG(Number(e.target.value))}>
            {heads.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Use function">
          <select value={fn} onChange={(e) => setFn(Number(e.target.value) as 9)}>
            <option value={9}>Sum</option>
            <option value={1}>Average</option>
            <option value={2}>Count</option>
            <option value={4}>Max</option>
            <option value={5}>Min</option>
            <option value={6}>Product</option>
          </select>
        </Field>
        <p className="hint">Add subtotal to:</p>
        <div className="checks">
          {heads.map(
            (h, i) =>
              i !== g && <Check key={i} label={h} checked={!!sum[i]} onChange={(v) => setSum({ ...sum, [i]: v })} />,
          )}
        </div>
        <div className="row-btns">
          <button
            className="primary"
            onClick={() =>
              setR(
                subtotalRun(
                  engine,
                  g,
                  Object.entries(sum)
                    .filter(([, v]) => v)
                    .map(([k]) => Number(k)),
                  fn,
                ),
              )
            }
          >
            Add subtotals
          </button>
          <button onClick={() => setR(removeSubtotalsRun(engine))}>Remove all</button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

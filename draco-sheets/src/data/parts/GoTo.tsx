import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { type SpecialKind } from '../dataTools';
import { goTo, goToSpecialRun, type Out } from '../dataGlue';
import { Field, Result } from './shared';

export function GoTo({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [ref, setRef] = useState('');
  const [kind, setKind] = useState<SpecialKind>('blanks');
  const [scope, setScope] = useState<'selection' | 'sheet'>('selection');
  const [r, setR] = useState<Out | null>(null);
  const KINDS: [SpecialKind, string][] = [
    ['blanks', 'Blanks'],
    ['constants', 'Constants'],
    ['numbers', 'Constants: numbers'],
    ['text', 'Constants: text'],
    ['logical', 'Constants: logical'],
    ['formulas', 'Formulas'],
    ['formulaNumbers', 'Formulas: numbers'],
    ['formulaText', 'Formulas: text'],
    ['formulaErrors', 'Formulas: errors'],
    ['errors', 'Errors'],
    ['lastCell', 'Last cell'],
  ];
  return (
    <>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const o = goTo(engine, ref);
          if (o.ok) onClose();
          else setR(o);
        }}
      >
        <Field label="Go to (cell, range or name)">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. D20, Sheet2!A1:C5, SalesData" />
        </Field>
        <div className="row-btns">
          <button className="primary">Go</button>
        </div>
      </form>
      <h3>Go To Special</h3>
      <div className="stack">
        <Field label="Select">
          <select value={kind} onChange={(e) => setKind(e.target.value as SpecialKind)}>
            {KINDS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Look in">
          <select value={scope} onChange={(e) => setScope(e.target.value as 'selection' | 'sheet')}>
            <option value="selection">Current selection</option>
            <option value="sheet">Whole sheet (used range)</option>
          </select>
        </Field>
        <div className="row-btns">
          <button className="primary" onClick={() => setR(goToSpecialRun(engine, kind, scope))}>
            Select cells
          </button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

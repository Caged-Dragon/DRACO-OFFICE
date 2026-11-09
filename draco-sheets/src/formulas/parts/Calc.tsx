import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { calculateNow, stopCalculation } from '../formulaTools';

export function Calc({ engine }: { engine: Engine }) {
  const [msg, setMsg] = useState('');
  return (
    <>
      <div className="row-btns">
        <button
          className="primary"
          onClick={() => {
            calculateNow(engine);
            setMsg('Recalculation started.');
          }}
        >
          Calculate now
        </button>
        <button
          onClick={() => {
            stopCalculation(engine);
            setMsg('Calculation stopped.');
          }}
        >
          Stop calculation
        </button>
      </div>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
      <p className="hint">
        Formulas recalculate automatically in a background worker. A manual-calculation mode and iterative calculation
        for circular references are not available in the current engine.
      </p>
    </>
  );
}

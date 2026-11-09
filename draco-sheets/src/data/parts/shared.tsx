import { Result } from '../../ui/form';
export { Check, Field, Result } from '../../ui/form';
import { useState, type ReactNode } from 'react';
import type { Engine } from '../../core/engine';
import { flashFillRun, type Out } from '../dataGlue';
import { Subtotal } from './Subtotal';

export type DataTab = 'goto' | 'dupes' | 'text' | 'flash' | 'adv' | 'subtotal' | 'table' | 'whatif' | 'consol';

export const TABS: [DataTab, string][] = [
  ['goto', 'Go To'],
  ['dupes', 'Remove duplicates'],
  ['text', 'Text to columns'],
  ['flash', 'Flash Fill'],
  ['adv', 'Advanced filter'],
  ['subtotal', 'Subtotal'],
  ['table', 'Format as table'],
  ['whatif', 'What-if'],
  ['consol', 'Consolidate'],
];

export function Flash({ engine }: { engine: Engine }) {
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">
        Type one or two examples in the column next to your data (for example “Smith, John” beside “John Smith”), click
        a cell in that column, then run Flash Fill. It learns the pattern from your examples and fills the rest.
      </p>
      <div className="row-btns">
        <button className="primary" onClick={() => setR(flashFillRun(engine))}>
          Flash Fill
        </button>
      </div>
      <Result r={r} />
    </>
  );
}

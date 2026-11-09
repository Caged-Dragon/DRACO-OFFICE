import { useState } from 'react';
import Dialog from '../ui/Dialog';
import EvaluateTab from './EvaluateTab';
import type { Engine } from '../core/engine';
import { jumpTo } from './formulaTools';
import { Audit } from './parts/Audit';
import { Calc } from './parts/Calc';
import { Errors } from './parts/Errors';
import { Names } from './parts/Names';
import { WatchWindow } from './parts/WatchWindow';
import { Tab, Watch } from './parts/shared';

export default function FormulasDialog({
  engine,
  initial = 'names',
  onClose,
}: {
  engine: Engine;
  initial?: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const jump = (s: string, r: number, c: number) => {
    jumpTo(engine, s, r, c);
    onClose();
  };
  return (
    <Dialog title="Formulas" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {(
          [
            ['names', 'Name Manager'],
            ['audit', 'Auditing'],
            ['evaluate', 'Evaluate formula'],
            ['errors', 'Error checking'],
            ['watch', 'Watch window'],
            ['calc', 'Calculation'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'on' : ''}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'names' && <Names engine={engine} />}
      {tab === 'audit' && <Audit engine={engine} jump={jump} />}
      {tab === 'evaluate' && <EvaluateTab engine={engine} />}
      {tab === 'errors' && <Errors engine={engine} jump={jump} />}
      {tab === 'watch' && <WatchWindow engine={engine} jump={jump} />}
      {tab === 'calc' && <Calc engine={engine} />}
    </Dialog>
  );
}

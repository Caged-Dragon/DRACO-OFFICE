import { useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { Adv } from './parts/Adv';
import { Consol } from './parts/Consol';
import { Dupes } from './parts/Dupes';
import { GoTo } from './parts/GoTo';
import { Subtotal } from './parts/Subtotal';
import { TableTab } from './parts/TableTab';
import { TextCols } from './parts/TextCols';
import { WhatIf } from './parts/WhatIf';
import { DataTab, Flash, TABS } from './parts/shared';

export default function DataDialog({
  engine,
  initial = 'goto',
  onClose,
}: {
  engine: Engine;
  initial?: DataTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DataTab>(initial);
  return (
    <Dialog title="Data tools" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
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
      {tab === 'goto' && <GoTo engine={engine} onClose={onClose} />}
      {tab === 'dupes' && <Dupes engine={engine} />}
      {tab === 'text' && <TextCols engine={engine} />}
      {tab === 'flash' && <Flash engine={engine} />}
      {tab === 'adv' && <Adv engine={engine} />}
      {tab === 'subtotal' && <Subtotal engine={engine} />}
      {tab === 'table' && <TableTab engine={engine} />}
      {tab === 'whatif' && <WhatIf engine={engine} />}
      {tab === 'consol' && <Consol engine={engine} />}
    </Dialog>
  );
}

import { useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { Camera } from './parts/Camera';
import { Diagram } from './parts/Diagram';
import { Icon } from './parts/Icon';
import { Manage } from './parts/Manage';
import { Shape } from './parts/Shape';
import { Spark } from './parts/Spark';
import { TABS, Tab } from './parts/shared';

export default function ObjectsDialog({
  engine,
  initial = 'spark',
  onClose,
}: {
  engine: Engine;
  initial?: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <Dialog title="Insert objects" onClose={onClose} wide>
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
      {tab === 'spark' && <Spark engine={engine} />}
      {tab === 'shape' && <Shape engine={engine} />}
      {tab === 'icon' && <Icon engine={engine} />}
      {tab === 'diagram' && <Diagram engine={engine} />}
      {tab === 'camera' && <Camera engine={engine} />}
      {tab === 'manage' && <Manage engine={engine} />}
    </Dialog>
  );
}

import { useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { Insert } from './parts/Insert';
import { Manage } from './parts/Manage';
import { S1, SAMPLE } from './parts/shared';

export default function ChartDialog({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [tab, setTab] = useState<'insert' | 'manage'>('insert');
  return (
    <Dialog title="Charts" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'insert'}
          className={tab === 'insert' ? 'on' : ''}
          onClick={() => setTab('insert')}
        >
          Insert chart
        </button>
        <button
          role="tab"
          aria-selected={tab === 'manage'}
          className={tab === 'manage' ? 'on' : ''}
          onClick={() => setTab('manage')}
        >
          Manage charts
        </button>
      </div>
      {tab === 'insert' ? <Insert engine={engine} onDone={onClose} /> : <Manage engine={engine} />}
    </Dialog>
  );
}

import { useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { FilesTab } from './parts/FilesTab';
import { PasteTab } from './parts/PasteTab';
import { PrintTab } from './parts/PrintTab';
import { VersionsTab } from './parts/VersionsTab';
import { FilesCtx, Tab } from './parts/shared';

export default function FilesDialog({
  engine,
  ctx,
  tab: first = 'files',
  onClose,
}: {
  engine: Engine;
  ctx: FilesCtx;
  tab?: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(first);
  return (
    <Dialog title="Files, print & history" onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Files sections">
        {(
          [
            ['files', 'Import / Export'],
            ['print', 'Print & PDF'],
            ['paste', 'Paste from Excel / Sheets'],
            ['versions', 'Version history'],
          ] as Array<[Tab, string]>
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
      {tab === 'files' && <FilesTab engine={engine} ctx={ctx} onClose={onClose} />}
      {tab === 'print' && <PrintTab engine={engine} ctx={ctx} />}
      {tab === 'paste' && <PasteTab engine={engine} />}
      {tab === 'versions' && <VersionsTab ctx={ctx} onClose={onClose} />}
    </Dialog>
  );
}

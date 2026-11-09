import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { t } from '../i18n/i18nGlue';
import * as G from './collabGlue';
import { roleLabel } from './share';
import { ChangesTab } from './parts/ChangesTab';
import { CommentsTab } from './parts/CommentsTab';
import { NotesTab } from './parts/NotesTab';
import { ProtectTab } from './parts/ProtectTab';
import { ShareTab } from './parts/ShareTab';
import { type CollabTab, useCollab } from './parts/shared';

export type { CollabTab };

export default function CollabDialog({
  tab: first = 'comments',
  onClose,
  getSnapshot,
  title,
}: {
  tab?: CollabTab;
  onClose: () => void;
  getSnapshot: () => Record<string, unknown> | null;
  title: string;
}) {
  const [tab, setTab] = useState<CollabTab>(first);
  useCollab();
  const tabs: Array<[CollabTab, string]> = [
    ['comments', 'Comments'],
    ['notes', 'Notes'],
    ['share', 'Share & live'],
    ['changes', 'Changes'],
    ['protect', 'Protect'],
  ];
  return (
    <Dialog title={t('Review & collaborate')} onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Review sections">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'on' : ''}
            onClick={() => setTab(k)}
          >
            {t(l)}
          </button>
        ))}
      </div>
      {G.inSession() && (
        <p className="hint" role="status">
          Live session {G.getRoom()} · you are {roleLabel(G.getRole()).toLowerCase()} · {G.getPeers().length + 1} here
        </p>
      )}
      {tab === 'comments' && <CommentsTab />}
      {tab === 'notes' && <NotesTab />}
      {tab === 'share' && <ShareTab getSnapshot={getSnapshot} title={title} />}
      {tab === 'changes' && <ChangesTab />}
      {tab === 'protect' && <ProtectTab />}
    </Dialog>
  );
}

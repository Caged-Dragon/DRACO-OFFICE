import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import { listLocal, listCloud, deleteLocal, deleteCloud, type WorkbookMeta } from './store';

export default function OpenDialog({ signedIn, onOpen, onClose }: { signedIn: boolean; onOpen: (m: WorkbookMeta) => void; onClose: () => void }) {
  const [rows, setRows] = useState<WorkbookMeta[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([listLocal(), signedIn ? listCloud().catch((e) => { setErr(String(e.message ?? e)); return []; }) : Promise.resolve([])]);
      setRows([...c, ...l].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const remove = async (m: WorkbookMeta) => {
    if (!confirm(`Delete "${m.title}"? This cannot be undone.`)) return;
    if (m.source === 'cloud') await deleteCloud(m.id);
    await deleteLocal(m.id);
    void refresh();
  };

  return (
    <Dialog title="Open workbook" onClose={onClose} wide>
      {err && <p className="msg">{err}</p>}
      {loading ? <p>Loading…</p> : rows.length === 0 ? <p>No saved workbooks yet.</p> : (
        <ul className="filelist">
          {rows.map((m) => (
            <li key={m.source + m.id}>
              <button className="row" onClick={() => onOpen(m)}>
                <span className="name">{m.title}</span>
                <span className="meta">{m.source === 'cloud' ? '☁ Cloud' : '▣ This device'} · {new Date(m.updatedAt).toLocaleString()}</span>
              </button>
              <button className="icon" aria-label={`Delete ${m.title}`} onClick={() => remove(m)}>🗑</button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

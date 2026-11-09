import { useEffect, useRef, useState } from 'react';
import type { Out } from '../../data/dataGlue';
import { type Snap } from '../model';
import { addVersion, deleteVersion, getVersion, listVersions, type VersionMeta } from '../../core/store';
import { describeDiff, diffSnapshots, snapHash, type Diff } from '../versions';
import { Field, FilesCtx, Result } from './shared';

export function VersionsTab({ ctx, onClose }: { ctx: FilesCtx; onClose: () => void }) {
  const [list, setList] = useState<VersionMeta[]>([]);
  const [label, setLabel] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const [diff, setDiff] = useState<{ title: string; d: Diff } | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = useRef(ctx);
  const reload = async () => setList(await listVersions(cur.current.id).catch(() => []));
  useEffect(() => {
    void reload();
  }, []);
  const save = async () => {
    const s = ctx.getSnapshot();
    if (!s) return;
    setBusy(true);
    try {
      const h = snapHash(s);
      await addVersion(ctx.id, s as never, label.trim() || 'Saved version', 'manual', h);
      ctx.markCheckpoint?.(h);
      setLabel('');
      setR({ ok: true, message: 'Version saved.' });
      await reload();
    } catch (e) {
      setR({ ok: false, message: `Couldn't save: ${(e as Error).message}` });
    }
    setBusy(false);
  };
  const compare = async (v: VersionMeta) => {
    const row = await getVersion(v.key);
    const now = ctx.getSnapshot();
    if (!row || !now) return;
    setDiff({ title: `${v.label} → now`, d: diffSnapshots(row.data as unknown as Snap, now) });
  };
  const restore = async (v: VersionMeta) => {
    const row = await getVersion(v.key);
    if (!row) return;
    if (
      !confirm(
        `Restore "${v.label}" from ${new Date(v.at).toLocaleString()}?\n\nThe current state is kept in the history, so you can come back to it.`,
      )
    )
      return;
    const now = ctx.getSnapshot();
    if (now) await addVersion(ctx.id, now as never, 'Before restoring "' + v.label + '"', 'manual', snapHash(now));
    ctx.onRestore(row.data as unknown as Snap, v.label);
    onClose();
  };
  const remove = async (v: VersionMeta) => {
    await deleteVersion(v.key);
    await reload();
  };
  return (
    <div>
      <div className="grid2">
        <Field label="Name this version (optional)">
          <input
            aria-label="Version name"
            value={label}
            placeholder="e.g. Before budget changes"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <div className="actions" style={{ alignItems: 'end' }}>
          <button className="primary" onClick={() => void save()} disabled={busy}>
            Save version now
          </button>
        </div>
      </div>
      <p className="hint">
        Draco also keeps an automatic checkpoint every few minutes while you edit (the latest 30 are kept). Named
        versions are never removed automatically.
      </p>
      <Result r={r} />
      {list.length === 0 ? (
        <p>No versions yet.</p>
      ) : (
        <ul className="versions" aria-label="Versions">
          {list.map((v) => (
            <li key={v.key}>
              <span>
                <b>{v.label}</b>{' '}
                <small>
                  {new Date(v.at).toLocaleString()} · {v.kind === 'manual' ? 'saved' : 'auto'}
                </small>
              </span>
              <span>
                <button onClick={() => void compare(v)}>Compare with now</button>
                <button onClick={() => void restore(v)}>Restore</button>
                <button onClick={() => void remove(v)} aria-label={`Delete version ${v.label}`}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {diff && (
        <div aria-label="Differences">
          <h3>{diff.title}</h3>
          <p className="hint">{describeDiff(diff.d)}</p>
          {diff.d.sheetsAdded.length > 0 && <p>Sheets added: {diff.d.sheetsAdded.join(', ')}</p>}
          {diff.d.sheetsRemoved.length > 0 && <p>Sheets removed: {diff.d.sheetsRemoved.join(', ')}</p>}
          {diff.d.sheetsRenamed.length > 0 && (
            <p>Renamed: {diff.d.sheetsRenamed.map((x) => `${x.from} → ${x.to}`).join(', ')}</p>
          )}
          {diff.d.changes.length > 0 && (
            <div className="qprev">
              <table>
                <thead>
                  <tr>
                    <th>Cell</th>
                    <th>Change</th>
                    <th>Then</th>
                    <th>Now</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.d.changes.slice(0, 200).map((c, i) => (
                    <tr key={i}>
                      <td>
                        {c.sheet}!{c.addr}
                      </td>
                      <td>{c.kind}</td>
                      <td>{c.before}</td>
                      <td>{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

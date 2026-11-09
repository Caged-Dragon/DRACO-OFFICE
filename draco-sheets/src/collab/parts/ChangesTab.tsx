import { useState } from 'react';
import { t } from '../../i18n/i18nGlue';
import * as G from '../collabGlue';
import { filterLog, users as logUsers } from '../changelog';
import { Check, Out, Result, addr, ago, saveText } from './shared';

export function ChangesTab() {
  const [user, setUser] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [r, setR] = useState<Out | null>(null);
  const all = G.getLog();
  const list = filterLog(all, { user: user || undefined, q })
    .slice()
    .reverse()
    .slice(0, 300);
  return (
    <div>
      <Check label="Track changes" checked={G.isTracking()} onChange={G.setTracking} />
      <p className="hint">
        Records who changed which cell, with the old and new value. Large bulk edits (over 5,000 cells) aren’t itemised.
      </p>
      <div className="row">
        <select aria-label="Changes by" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">Everyone</option>
          {logUsers(all).map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <input aria-label="Search changes" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => saveText('changes.csv', G.logCsv())}>Export CSV</button>
      </div>
      <div className="table-wrap">
        <table className="chg">
          <thead>
            <tr>
              <th />
              <th>When</th>
              <th>Who</th>
              <th>Cell</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select change ${addr(c.r, c.c)}`}
                    checked={sel.has(c.id)}
                    onChange={(e) => {
                      const n = new Set(sel);
                      if (e.target.checked) n.add(c.id);
                      else n.delete(c.id);
                      setSel(n);
                    }}
                  />
                </td>
                <td>{ago(c.at)}</td>
                <td>{c.user}</td>
                <td>
                  {c.sheet}!{addr(c.r, c.c)}
                </td>
                <td className="mono">{c.before || '—'}</td>
                <td className="mono">{c.after || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="hint">No changes recorded.</p>}
      <div className="row">
        <button
          disabled={!sel.size}
          onClick={() => {
            const o = G.revertChanges([...sel]);
            setR(o);
            setSel(new Set());
          }}
        >
          Revert selected
        </button>
        <button onClick={() => setR(G.clearLog())}>Clear history</button>
      </div>
      <Result r={r} />
    </div>
  );
}

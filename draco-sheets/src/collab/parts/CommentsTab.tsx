import { useMemo, useState } from 'react';
import { t } from '../../i18n/i18nGlue';
import * as G from '../collabGlue';
import { ThreadCard } from './ThreadCard';
import { Check, Out, Result, addr, saveText } from './shared';

export function CommentsTab() {
  const [text, setText] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [q, setQ] = useState('');
  const [here, setHere] = useState(false);
  const cell = G.selectionCell();
  const list = G.commentsList({ status, q, sheetId: here ? cell?.sheetId : undefined });
  const sum = useMemo(() => {
    const c = G.getComments();
    return { open: c.threads.filter((t) => !t.resolved).length, done: c.threads.filter((t) => t.resolved).length };
  }, [G.version()]);
  return (
    <div>
      <h3>New comment {cell ? `on ${addr(cell.r, cell.c)}` : ''}</h3>
      <textarea
        aria-label="Comment text"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment about the selected cell…"
      />
      <div className="row">
        <button
          className="primary"
          onClick={() => {
            const o = G.addComment(text);
            setR(o);
            if (o.ok) setText('');
          }}
        >
          Comment
        </button>
      </div>
      <Result r={r} />
      <h3>
        Threads ({sum.open} open, {sum.done} resolved)
      </h3>
      <div className="row">
        <select
          aria-label="Comment status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <input aria-label="Search comments" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Check label="This sheet only" checked={here} onChange={setHere} />
        <button onClick={() => saveText('comments.csv', G.commentsCsv())}>Export CSV</button>
      </div>
      {!list.length && <p className="hint">No comments here yet.</p>}
      <ul className="thread-list">
        {list.map((t) => (
          <ThreadCard key={t.id} t={t} />
        ))}
      </ul>
    </div>
  );
}

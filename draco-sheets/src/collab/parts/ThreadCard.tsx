import { useState } from 'react';
import { t } from '../../i18n/i18nGlue';
import * as G from '../collabGlue';
import { initials, type Thread } from '../comments';
import { Out, Result, addr, ago } from './shared';

export function ThreadCard({ t }: { t: Thread }) {
  const [reply, setReply] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [r, setR] = useState<Out | null>(null);
  const wb = G.getComments();
  void wb;
  return (
    <li className={'thread' + (t.resolved ? ' resolved' : '')} data-thread={t.id}>
      <div className="thread-head">
        <span className="avatar" style={{ background: G.colorOf(t.author) }}>
          {initials(t.author)}
        </span>
        <b>{t.author}</b>{' '}
        <span className="muted">
          {ago(t.at)}
          {t.edited ? ' · edited' : ''}
        </span>
        <button className="link" onClick={() => G.goToCell(t.sheetId, t.r, t.c)}>
          {G.sheetLabel(t.sheetId)}!{addr(t.r, t.c)}
        </button>
      </div>
      {edit === null ? (
        <p className="thread-text">{t.text}</p>
      ) : (
        <div>
          <textarea aria-label="Edit comment" rows={2} value={edit} onChange={(e) => setEdit(e.target.value)} />
          <button
            onClick={() => {
              setR(G.editComment(t.id, edit));
              setEdit(null);
            }}
          >
            Save
          </button>{' '}
          <button onClick={() => setEdit(null)}>Cancel</button>
        </div>
      )}
      {t.replies.map((x) => (
        <div className="reply" key={x.id}>
          <b>{x.author}</b> <span className="muted">{ago(x.at)}</span>
          <p>{x.text}</p>
          <button className="link" onClick={() => setR(G.deleteComment(t.id, x.id))}>
            Delete reply
          </button>
        </div>
      ))}
      {t.resolved && <p className="hint">Resolved by {t.resolvedBy}</p>}
      <div className="row">
        <input aria-label="Reply" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
        <button
          onClick={() => {
            const o = G.replyTo(t.id, reply);
            setR(o);
            if (o.ok) setReply('');
          }}
        >
          Reply
        </button>
        <button onClick={() => setR(G.resolveThread(t.id, !t.resolved))}>{t.resolved ? 'Reopen' : 'Resolve'}</button>
        <button onClick={() => setEdit(t.text)}>Edit</button>
        <button onClick={() => setR(G.deleteComment(t.id))}>Delete</button>
      </div>
      {r && !r.ok && <Result r={r} />}
    </li>
  );
}

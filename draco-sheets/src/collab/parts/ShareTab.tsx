import { useState } from 'react';
import * as G from '../collabGlue';
import { initials } from '../comments';
import { ROLES, roleLabel, type Role } from '../share';
import { CloudShares } from './CloudShares';
import { Field, Out, Result } from './shared';

export function ShareTab({ getSnapshot, title }: { getSnapshot: () => Record<string, unknown> | null; title: string }) {
  const [name, setName] = useState(G.me.name);
  const [role, setRole] = useState<Role>('edit');
  const [code, setCode] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const [link, setLink] = useState('');
  const [linkRole, setLinkRole] = useState<Role>('view');
  const info = G.sessionInfo();
  const roomUrl = (ro: Role) => {
    const o = G.makeRoomLink(ro);
    return o.ok ? String(o.url) : '';
  };
  return (
    <div>
      <h3>You</h3>
      <div className="row">
        <input
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => G.setMyName(name)}
        />
        <span className="avatar" style={{ background: G.me.color }}>
          {initials(name)}
        </span>
      </div>
      {!info.active ? (
        <>
          <h3>Live co-editing</h3>
          <p className="hint">
            Work on the same workbook at the same time. Sessions connect browsers on this device and, when signed in to
            the cloud, across devices.
          </p>
          <div className="row">
            <Field label="Guests can">
              <select aria-label="Guest role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((x) => (
                  <option key={x} value={x}>
                    {roleLabel(x).replace('Can ', '')}
                  </option>
                ))}
              </select>
            </Field>
            <button
              className="primary"
              onClick={() => {
                G.setMyName(name);
                setR(G.hostSession(role));
              }}
            >
              Start live session
            </button>
          </div>
          <div className="row">
            <input
              aria-label="Session code or link"
              placeholder="Session code or link"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              onClick={() => {
                G.setMyName(name);
                setR(G.joinSession(code));
              }}
            >
              Join
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>
            Session{' '}
            <span className="code" aria-label="Session code">
              {info.room}
            </span>
          </h3>
          <div className="row">
            {ROLES.map((x) => (
              <button
                key={x}
                onClick={() => {
                  const u = roomUrl(x);
                  void navigator.clipboard?.writeText(u).catch(() => undefined);
                  setLink(u);
                  setR({ ok: true, message: `Copied the ${x} link` });
                }}
              >
                Copy {x} link
              </button>
            ))}
          </div>
          {link && <input aria-label="Session link" readOnly value={link} onFocus={(e) => e.target.select()} />}
          <h3>People ({info.peers.length + 1})</h3>
          <ul className="thread-list">
            <li className="thread">
              <span className="avatar" style={{ background: G.me.color }}>
                {initials(G.me.name)}
              </span>{' '}
              {G.me.name} (you) · {info.host ? 'host' : roleLabel(info.role).toLowerCase()}
            </li>
            {info.peers.map((p) => (
              <li className="thread" key={p.id} data-peer={p.name}>
                <span className="avatar" style={{ background: p.color }}>
                  {initials(p.name)}
                </span>{' '}
                {p.name}
                {p.host ? ' (host)' : ''}
                {info.host && !p.host ? (
                  <select
                    aria-label={`Role for ${p.name}`}
                    value={p.role}
                    onChange={(e) => G.setGuestRole(p.id, e.target.value as Role)}
                  >
                    {ROLES.map((x) => (
                      <option key={x} value={x}>
                        {roleLabel(x)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="muted"> · {roleLabel(p.role).toLowerCase()}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="row">
            {!info.host && <button onClick={() => setR(G.resync())}>Resync from host</button>}
            <button
              onClick={() => {
                G.leaveSession();
                setR({ ok: true, message: 'Left the session' });
              }}
            >
              Leave session
            </button>
          </div>
        </>
      )}
      <Result r={r} />
      <CloudShares title={title} />
      <h3>Share a copy by link</h3>
      <p className="hint">
        The whole workbook is packed into the link itself (nothing is uploaded). People who open it get their own copy.
      </p>
      <div className="row">
        <Field label="Opens as">
          <select aria-label="Link access" value={linkRole} onChange={(e) => setLinkRole(e.target.value as Role)}>
            <option value="view">View only copy</option>
            <option value="comment">Can comment</option>
            <option value="edit">Editable copy</option>
          </select>
        </Field>
        <button
          onClick={async () => {
            const s = getSnapshot();
            if (!s) return setR({ ok: false, message: 'No workbook' });
            const o = await G.makeShareLink(linkRole, s, title);
            setR(o);
            setLink(o.ok ? String(o.url) : '');
          }}
        >
          Create link
        </button>
      </div>
      {link && (
        <div className="row">
          <textarea aria-label="Share link" readOnly rows={3} value={link} onFocus={(e) => e.target.select()} />
          <button onClick={() => void navigator.clipboard?.writeText(link).catch(() => undefined)}>Copy</button>
        </div>
      )}
    </div>
  );
}

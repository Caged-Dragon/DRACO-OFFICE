import { useEffect, useState, type ReactNode } from 'react';
import type { Engine } from '../core/engine';
import * as G from './linksGlue';
import { kindLabel, isPrivateHost } from './links';

type Out = { ok: boolean; message: string };
const Result = ({ r }: { r: Out | null }) =>
  r ? (
    <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>
      {r.ok ? '✔ ' : ''}
      {r.message}
    </p>
  ) : null;
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label>
    {label}
    {children}
  </label>
);
export default function LinksTab({ engine }: { engine: Engine }) {
  const [type, setType] = useState<G.InsertSpec['type']>('web');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const [n, setN] = useState(0);
  const [links, setLinks] = useState<G.LinkRow[]>([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [header, setHeader] = useState(true);
  const [dest, setDest] = useState('');
  const [wr, setWr] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const [every, setEvery] = useState(0);
  const [conns, setConns] = useState(G.listConnections());
  useEffect(() => {
    setLinks(G.listLinks(engine));
    setConns(G.listConnections());
  }, [engine, n]);
  useEffect(() => {
    if (!every) return;
    const t = window.setInterval(() => {
      void G.refreshAllConnections(engine).then((o) => {
        setWr(o);
        setN((x) => x + 1);
      });
    }, every * 60_000);
    return () => window.clearInterval(t);
  }, [every, engine]);
  const hint = {
    web: 'https://example.com or www.example.com',
    mail: 'name@example.com',
    sheet: 'Sheet name',
    cell: 'B2 or Sheet2!A1:C3',
    name: 'Named range',
  }[type];
  return (
    <div>
      <h3>Insert link in the selected cell</h3>
      <div className="row">
        <Field label="Link to">
          <select aria-label="Link type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="web">Web page</option>
            <option value="mail">Email address</option>
            <option value="sheet">Sheet in this workbook</option>
            <option value="cell">Cell or range here</option>
            <option value="name">Named range</option>
          </select>
        </Field>
      </div>
      <div className="row">
        <input aria-label="Link target" placeholder={hint} value={target} onChange={(e) => setTarget(e.target.value)} />
        <input
          aria-label="Link text"
          placeholder="Text to show (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          className="primary"
          onClick={async () => {
            const o = await G.insertLink(engine, { type, target, label });
            setR(o);
            setN(n + 1);
          }}
        >
          Add link
        </button>
      </div>
      <Result r={r} />
      <h3>Links in this workbook ({links.length})</h3>
      {!links.length && <p className="hint">No links yet.</p>}
      <ul className="thread-list">
        {links.map((l) => (
          <li className="thread" key={`${l.sheetId}${l.a1}`} data-link={l.a1}>
            <div className="thread-head">
              <button className="link" onClick={() => G.goToCell(engine, l.sheetId, l.row, l.col)}>
                {l.sheet}!{l.a1}
              </button>
              <span className="muted">{kindLabel(l.kind)}</span>
              <span className="mono-wrap">{l.label}</span>
              {l.broken && <b className="msg">{l.broken}</b>}
            </div>
            <div className="row">
              {l.kind === 'web' && (
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                  Open
                </a>
              )}
              {(l.kind === 'sheet' || l.kind === 'range') && (
                <button onClick={() => setR(G.followInternal(engine, l.url))}>Go</button>
              )}
              <button
                onClick={() => {
                  setR(G.removeLink(engine, l.sheetId, l.row, l.col));
                  setN(n + 1);
                }}
              >
                Remove link
              </button>
            </div>
          </li>
        ))}
      </ul>
      <h3>Web data connections</h3>
      <p className="hint">
        Pull a table from a web address into the sheet — CSV, JSON or a page with an HTML table — and refresh it later.
        The site must allow browser access (CORS).
      </p>
      <div className="row">
        <input
          aria-label="Web data address"
          placeholder="https://example.com/data.csv"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input aria-label="Connection name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row">
        <input
          aria-label="Place at"
          placeholder="Place at, e.g. Sheet1!F1 (optional)"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
        />
        <label className="inline">
          <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> First row is a header
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const o = await G.addWebData(engine, { url, name, header, dest });
            setBusy(false);
            setWr(o);
            setN(n + 1);
          }}
        >
          Get data
        </button>
      </div>
      {url && isPrivateHost(url) && (
        <p className="hint">
          That address is on your own network or this computer — it only works while that server is running.
        </p>
      )}
      <Result r={wr} />
      <ul className="thread-list">
        {conns.map((c) => (
          <li className="thread" key={c.id} data-conn={c.name}>
            <div className="thread-head">
              <b>{c.name}</b>
              <span className="muted">
                {c.rows ?? 0} rows × {c.cols ?? 0} cols at {c.dest}
              </span>
            </div>
            <div className="mono-wrap">{c.url}</div>
            <div className="row">
              <button
                onClick={async () => {
                  setBusy(true);
                  const o = await G.refreshConnection(engine, c.id);
                  setBusy(false);
                  setWr(o);
                  setN(n + 1);
                }}
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  setWr(G.removeConnection(engine, c.id, false));
                  setN(n + 1);
                }}
              >
                Disconnect
              </button>
              <button
                onClick={() => {
                  setWr(G.removeConnection(engine, c.id, true));
                  setN(n + 1);
                }}
              >
                Disconnect and clear data
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!!conns.length && (
        <div className="row">
          <button
            onClick={async () => {
              setBusy(true);
              const o = await G.refreshAllConnections(engine);
              setBusy(false);
              setWr(o);
              setN(n + 1);
            }}
          >
            Refresh all
          </button>
          <label>
            Auto-refresh while this window is open{' '}
            <select aria-label="Auto refresh" value={every} onChange={(e) => setEvery(+e.target.value)}>
              <option value={0}>Off</option>
              <option value={1}>Every minute</option>
              <option value={5}>Every 5 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={60}>Every hour</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

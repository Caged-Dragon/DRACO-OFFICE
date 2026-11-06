import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import Dialog from '../Dialog';
import { t } from '../i18n/i18nGlue';
import * as G from './collabGlue';
import { initials, type Thread } from './comments';
import { cloudCtx, createCloudShare, listCloudShares, revokeCloudShare, cloudShareUrl, type ShareRole, type ShareRow } from '../store';
import { ROLES, roleLabel, type Role } from './share';
import { defaultAllow, type Allow } from './protect';
import { filterLog, users as logUsers } from './changelog';
import { download } from '../files/filesGlue';

type Out = { ok: boolean; message: string; [k: string]: unknown };
export type CollabTab = 'comments' | 'notes' | 'share' | 'changes' | 'protect';
const Result = ({ r }: { r: Out | null }) => (r ? <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p> : null);
const Check = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => <label className="inline"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const ago = (iso: string) => { const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return new Date(iso).toLocaleDateString(); };
const useCollab = () => useSyncExternalStore(G.subscribe, G.version);
const colName = (c: number) => { let s = '', n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const addr = (r: number, c: number) => `${colName(c)}${r + 1}`;
const saveText = (name: string, text: string, mime = 'text/csv') => download({ name, data: text, mime: mime + ';charset=utf-8' });

export default function CollabDialog({ tab: first = 'comments', onClose, getSnapshot, title }: { tab?: CollabTab; onClose: () => void; getSnapshot: () => Record<string, unknown> | null; title: string }) {
  const [tab, setTab] = useState<CollabTab>(first); useCollab();
  const tabs: Array<[CollabTab, string]> = [['comments', 'Comments'], ['notes', 'Notes'], ['share', 'Share & live'], ['changes', 'Changes'], ['protect', 'Protect']];
  return (
    <Dialog title={t('Review & collaborate')} onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Review sections">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>)}
      </div>
      {G.inSession() && <p className="hint" role="status">Live session {G.getRoom()} · you are {roleLabel(G.getRole()).toLowerCase()} · {G.getPeers().length + 1} here</p>}
      {tab === 'comments' && <CommentsTab />}
      {tab === 'notes' && <NotesTab />}
      {tab === 'share' && <ShareTab getSnapshot={getSnapshot} title={title} />}
      {tab === 'changes' && <ChangesTab />}
      {tab === 'protect' && <ProtectTab />}
    </Dialog>
  );
}

function CommentsTab() {
  const [text, setText] = useState(''); const [r, setR] = useState<Out | null>(null); const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open'); const [q, setQ] = useState(''); const [here, setHere] = useState(false);
  const cell = G.selectionCell(); const list = G.commentsList({ status, q, sheetId: here ? cell?.sheetId : undefined }); const sum = useMemo(() => { const c = G.getComments(); return { open: c.threads.filter((t) => !t.resolved).length, done: c.threads.filter((t) => t.resolved).length }; }, [G.version()]);
  return (
    <div>
      <h3>New comment {cell ? `on ${addr(cell.r, cell.c)}` : ''}</h3>
      <textarea aria-label="Comment text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment about the selected cell…" />
      <div className="row"><button className="primary" onClick={() => { const o = G.addComment(text); setR(o); if (o.ok) setText(''); }}>Comment</button></div>
      <Result r={r} />
      <h3>Threads ({sum.open} open, {sum.done} resolved)</h3>
      <div className="row">
        <select aria-label="Comment status filter" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select>
        <input aria-label="Search comments" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Check label="This sheet only" checked={here} onChange={setHere} />
        <button onClick={() => saveText('comments.csv', G.commentsCsv())}>Export CSV</button>
      </div>
      {!list.length && <p className="hint">No comments here yet.</p>}
      <ul className="thread-list">{list.map((t) => <ThreadCard key={t.id} t={t} />)}</ul>
    </div>
  );
}
function ThreadCard({ t }: { t: Thread }) {
  const [reply, setReply] = useState(''); const [edit, setEdit] = useState<string | null>(null); const [r, setR] = useState<Out | null>(null); const wb = G.getComments(); void wb;
  return (
    <li className={'thread' + (t.resolved ? ' resolved' : '')} data-thread={t.id}>
      <div className="thread-head"><span className="avatar" style={{ background: G.colorOf(t.author) }}>{initials(t.author)}</span><b>{t.author}</b> <span className="muted">{ago(t.at)}{t.edited ? ' · edited' : ''}</span>
        <button className="link" onClick={() => G.goToCell(t.sheetId, t.r, t.c)}>{G.sheetLabel(t.sheetId)}!{addr(t.r, t.c)}</button></div>
      {edit === null ? <p className="thread-text">{t.text}</p> : <div><textarea aria-label="Edit comment" rows={2} value={edit} onChange={(e) => setEdit(e.target.value)} /><button onClick={() => { setR(G.editComment(t.id, edit)); setEdit(null); }}>Save</button> <button onClick={() => setEdit(null)}>Cancel</button></div>}
      {t.replies.map((x) => <div className="reply" key={x.id}><b>{x.author}</b> <span className="muted">{ago(x.at)}</span><p>{x.text}</p><button className="link" onClick={() => setR(G.deleteComment(t.id, x.id))}>Delete reply</button></div>)}
      {t.resolved && <p className="hint">Resolved by {t.resolvedBy}</p>}
      <div className="row"><input aria-label="Reply" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} /><button onClick={() => { const o = G.replyTo(t.id, reply); setR(o); if (o.ok) setReply(''); }}>Reply</button>
        <button onClick={() => setR(G.resolveThread(t.id, !t.resolved))}>{t.resolved ? 'Reopen' : 'Resolve'}</button><button onClick={() => setEdit(t.text)}>Edit</button><button onClick={() => setR(G.deleteComment(t.id))}>Delete</button></div>
      {r && !r.ok && <Result r={r} />}
    </li>
  );
}

function NotesTab() {
  const [text, setText] = useState(''); const [r, setR] = useState<Out | null>(null); const cell = G.selectionCell(); const notes = G.listNotes();
  useEffect(() => { const n = cell ? notes.find((x) => x.sheetId === cell.sheetId && x.r === cell.r && x.c === cell.c) : null; setText(n?.text ?? ''); }, [cell?.sheetId, cell?.r, cell?.c]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <h3>Note {cell ? `on ${addr(cell.r, cell.c)}` : ''}</h3>
      <p className="hint">A note is a plain sticky note on a cell (no replies). Use comments for conversations.</p>
      <textarea aria-label="Note text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row"><button className="primary" onClick={() => setR(G.setNote(text))}>{text.trim() ? 'Save note' : 'Delete note'}</button></div><Result r={r} />
      <h3>All notes ({notes.length})</h3>
      <div className="row"><button onClick={() => saveText('notes.csv', G.notesCsv())}>Export CSV</button></div>
      <ul className="thread-list">{notes.map((n) => <li className="thread" key={n.id}><button className="link" onClick={() => G.goToCell(n.sheetId, n.r, n.c)}>{n.sheet}!{addr(n.r, n.c)}</button><p className="thread-text">{n.text}</p><button onClick={() => setR(G.deleteNote(n))}>Delete</button></li>)}</ul>
    </div>
  );
}

function ShareTab({ getSnapshot, title }: { getSnapshot: () => Record<string, unknown> | null; title: string }) {
  const [name, setName] = useState(G.me.name); const [role, setRole] = useState<Role>('edit'); const [code, setCode] = useState(''); const [r, setR] = useState<Out | null>(null); const [link, setLink] = useState(''); const [linkRole, setLinkRole] = useState<Role>('view'); const info = G.sessionInfo();
  const roomUrl = (ro: Role) => { const o = G.makeRoomLink(ro); return o.ok ? String(o.url) : ''; };
  return (
    <div>
      <h3>You</h3>
      <div className="row"><input aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => G.setMyName(name)} /><span className="avatar" style={{ background: G.me.color }}>{initials(name)}</span></div>
      {!info.active ? <>
        <h3>Live co-editing</h3>
        <p className="hint">Work on the same workbook at the same time. Sessions connect browsers on this device and, when signed in to the cloud, across devices.</p>
        <div className="row"><Field label="Guests can"><select aria-label="Guest role" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((x) => <option key={x} value={x}>{roleLabel(x).replace('Can ', '')}</option>)}</select></Field><button className="primary" onClick={() => { G.setMyName(name); setR(G.hostSession(role)); }}>Start live session</button></div>
        <div className="row"><input aria-label="Session code or link" placeholder="Session code or link" value={code} onChange={(e) => setCode(e.target.value)} /><button onClick={() => { G.setMyName(name); setR(G.joinSession(code)); }}>Join</button></div>
      </> : <>
        <h3>Session <span className="code" aria-label="Session code">{info.room}</span></h3>
        <div className="row">{ROLES.map((x) => <button key={x} onClick={() => { const u = roomUrl(x); void navigator.clipboard?.writeText(u).catch(() => undefined); setLink(u); setR({ ok: true, message: `Copied the ${x} link` }); }}>Copy {x} link</button>)}</div>
        {link && <input aria-label="Session link" readOnly value={link} onFocus={(e) => e.target.select()} />}
        <h3>People ({info.peers.length + 1})</h3>
        <ul className="thread-list"><li className="thread"><span className="avatar" style={{ background: G.me.color }}>{initials(G.me.name)}</span> {G.me.name} (you) · {info.host ? 'host' : roleLabel(info.role).toLowerCase()}</li>
          {info.peers.map((p) => <li className="thread" key={p.id} data-peer={p.name}><span className="avatar" style={{ background: p.color }}>{initials(p.name)}</span> {p.name}{p.host ? ' (host)' : ''}
            {info.host && !p.host ? <select aria-label={`Role for ${p.name}`} value={p.role} onChange={(e) => G.setGuestRole(p.id, e.target.value as Role)}>{ROLES.map((x) => <option key={x} value={x}>{roleLabel(x)}</option>)}</select> : <span className="muted"> · {roleLabel(p.role).toLowerCase()}</span>}</li>)}</ul>
        <div className="row">{!info.host && <button onClick={() => setR(G.resync())}>Resync from host</button>}<button onClick={() => { G.leaveSession(); setR({ ok: true, message: 'Left the session' }); }}>Leave session</button></div>
      </>}
      <Result r={r} />
      <CloudShares title={title} />
      <h3>Share a copy by link</h3>
      <p className="hint">The whole workbook is packed into the link itself (nothing is uploaded). People who open it get their own copy.</p>
      <div className="row"><Field label="Opens as"><select aria-label="Link access" value={linkRole} onChange={(e) => setLinkRole(e.target.value as Role)}><option value="view">View only copy</option><option value="comment">Can comment</option><option value="edit">Editable copy</option></select></Field>
        <button onClick={async () => { const s = getSnapshot(); if (!s) return setR({ ok: false, message: 'No workbook' }); const o = await G.makeShareLink(linkRole, s, title); setR(o); setLink(o.ok ? String(o.url) : ''); }}>Create link</button></div>
      {link && <div className="row"><textarea aria-label="Share link" readOnly rows={3} value={link} onFocus={(e) => e.target.select()} /><button onClick={() => void navigator.clipboard?.writeText(link).catch(() => undefined)}>Copy</button></div>}
    </div>
  );
}

function ChangesTab() {
  const [user, setUser] = useState(''); const [q, setQ] = useState(''); const [sel, setSel] = useState<Set<string>>(new Set()); const [r, setR] = useState<Out | null>(null);
  const all = G.getLog(); const list = filterLog(all, { user: user || undefined, q }).slice().reverse().slice(0, 300);
  return (
    <div>
      <Check label="Track changes" checked={G.isTracking()} onChange={G.setTracking} />
      <p className="hint">Records who changed which cell, with the old and new value. Large bulk edits (over 5,000 cells) aren’t itemised.</p>
      <div className="row"><select aria-label="Changes by" value={user} onChange={(e) => setUser(e.target.value)}><option value="">Everyone</option>{logUsers(all).map((u) => <option key={u}>{u}</option>)}</select><input aria-label="Search changes" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => saveText('changes.csv', G.logCsv())}>Export CSV</button></div>
      <div className="table-wrap"><table className="chg"><thead><tr><th /><th>When</th><th>Who</th><th>Cell</th><th>Before</th><th>After</th></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id}><td><input type="checkbox" aria-label={`Select change ${addr(c.r, c.c)}`} checked={sel.has(c.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(c.id); else n.delete(c.id); setSel(n); }} /></td><td>{ago(c.at)}</td><td>{c.user}</td><td>{c.sheet}!{addr(c.r, c.c)}</td><td className="mono">{c.before || '—'}</td><td className="mono">{c.after || '—'}</td></tr>)}</tbody></table></div>
      {!list.length && <p className="hint">No changes recorded.</p>}
      <div className="row"><button disabled={!sel.size} onClick={() => { const o = G.revertChanges([...sel]); setR(o); setSel(new Set()); }}>Revert selected</button><button onClick={() => setR(G.clearLog())}>Clear history</button></div><Result r={r} />
    </div>
  );
}

function ProtectTab() {
  const sp = G.getProtection(); const wp = G.getWbProtection(); const [pw, setPw] = useState(''); const [allow, setAllow] = useState<Allow>(defaultAllow()); const [un, setUn] = useState(''); const [r, setR] = useState<Out | null>(null); const [wpw, setWpw] = useState(''); const set = (k: keyof Allow) => (v: boolean) => setAllow({ ...allow, [k]: v });
  return (
    <div>
      <h3>Protect this sheet {sp.enabled ? '— protected' : ''}</h3>
      {!sp.enabled ? <>
        <Field label="Password (optional)"><input aria-label="Sheet password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <p className="hint">Everyone can do this on a protected sheet:</p>
        <div className="grid2"><Check label="Select locked cells" checked={allow.selectLocked} onChange={set('selectLocked')} /><Check label="Select unlocked cells" checked={allow.selectUnlocked} onChange={set('selectUnlocked')} /><Check label="Format cells" checked={allow.formatCells} onChange={set('formatCells')} /><Check label="Insert rows" checked={allow.insertRows} onChange={set('insertRows')} /><Check label="Insert columns" checked={allow.insertColumns} onChange={set('insertColumns')} /><Check label="Delete rows" checked={allow.deleteRows} onChange={set('deleteRows')} /><Check label="Delete columns" checked={allow.deleteColumns} onChange={set('deleteColumns')} /><Check label="Sort" checked={allow.sort} onChange={set('sort')} /><Check label="Use filter" checked={allow.filter} onChange={set('filter')} /><Check label="Edit objects" checked={allow.objects} onChange={set('objects')} /></div>
        <Field label="Cells people may still edit (e.g. B2:B10, D4)"><input aria-label="Unlocked ranges" value={un} onChange={(e) => setUn(e.target.value)} placeholder="Leave empty to lock every cell" /></Field>
        <div className="row"><button className="primary" onClick={async () => setR(await G.protectSheet({ password: pw || undefined, allow, unlocked: un.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean) }))}>Protect sheet</button></div>
      </> : <>
        <p className="hint">Locked cells can’t be edited{sp.unlocked.length ? `; unlocked: ${sp.unlocked.join(', ')}` : ''}.{sp.hash ? ' A password is required to unprotect.' : ''}</p>
        {sp.hash && <Field label="Password"><input aria-label="Sheet password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>}
        <div className="row"><button onClick={async () => { const o = await G.unprotectSheet(pw); setR(o); if (o.ok) setPw(''); }}>Unprotect sheet</button></div>
      </>}
      <h3>Protect workbook structure {wp.enabled ? '— protected' : ''}</h3>
      <p className="hint">Stops sheets being added, deleted, renamed, moved or hidden.</p>
      {wp.hash && wp.enabled && <Field label="Password"><input aria-label="Workbook password" type="password" value={wpw} onChange={(e) => setWpw(e.target.value)} /></Field>}
      {!wp.enabled && <Field label="Password (optional)"><input aria-label="Workbook password" type="password" value={wpw} onChange={(e) => setWpw(e.target.value)} autoComplete="new-password" /></Field>}
      <div className="row">{wp.enabled ? <button onClick={async () => { const o = await G.unprotectWorkbook(wpw); setR(o); if (o.ok) setWpw(''); }}>Unprotect workbook</button> : <button onClick={async () => { setR(await G.protectWorkbook(wpw || undefined)); setWpw(''); }}>Protect workbook</button>}</div>
      <Result r={r} />
      <p className="hint">Protection is a guard against accidents, like Excel’s: it isn’t encryption, and anyone with the file can remove it.</p>
    </div>
  );
}

function CloudShares({ title }: { title: string }) {
  const [role, setRole] = useState<ShareRole>('view'); const [days, setDays] = useState(0); const [rows, setRows] = useState<ShareRow[]>([]); const [r, setR] = useState<Out | null>(null); const id = cloudCtx.id;
  const load = () => { if (id) void listCloudShares(id).then(setRows).catch(() => setRows([])); };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return <><h3>Cloud share link (checked on the server)</h3><p className="hint">Save this workbook to the cloud while signed in (Save to cloud), then come back here to create a link whose view / comment / edit role the server enforces and you can revoke.</p></>;
  const live = (x: ShareRow) => !x.revoked && (!x.expires_at || new Date(x.expires_at) > new Date());
  return (
    <>
      <h3>Cloud share link (checked on the server)</h3>
      <p className="hint">Unlike a copy link, this opens the live workbook "{title}". The role is enforced by the database, so it can't be widened by editing the page, and you can switch the link off at any time.</p>
      <div className="row"><Field label="Role"><select aria-label="Cloud link role" value={role} onChange={(e) => setRole(e.target.value as ShareRole)}><option value="view">View only</option><option value="comment">Comment only</option><option value="edit">Can edit</option></select></Field>
        <Field label="Expires after (days, 0 = never)"><input type="number" min={0} aria-label="Expiry days" value={days} onChange={(e) => setDays(Math.max(0, +e.target.value))} /></Field>
        <button onClick={async () => { try { const x = await createCloudShare(id, role, days || undefined); setR({ ok: true, message: 'Link created. Copy it below.' }); void navigator.clipboard?.writeText(cloudShareUrl(location.origin, x.token)).catch(() => undefined); load(); } catch (e) { setR({ ok: false, message: (e as Error).message || 'Could not create the link — are you signed in and is the workbook saved to the cloud?' }); } }}>Create cloud link</button></div>
      <ul className="thread-list">{rows.map((x) => <li className="thread" key={x.id}><span className="mono">…{x.token.slice(-6)}</span> · {x.role}{x.expires_at ? ` · expires ${new Date(x.expires_at).toLocaleDateString()}` : ''} · {live(x) ? 'active' : 'off'}
        {live(x) && <> <button onClick={() => void navigator.clipboard?.writeText(cloudShareUrl(location.origin, x.token))}>Copy link</button> <button onClick={async () => { await revokeCloudShare(x.id).catch(() => undefined); load(); }}>Switch off</button></>}</li>)}</ul>
      <Result r={r} />
    </>
  );
}

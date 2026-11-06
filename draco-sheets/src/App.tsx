import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Engine } from './engine';
import { supabase, cloudEnabled } from './supabase';
import {
  newId, cloudCtx, openCloudShare, saveCloudShare, cloudTokenFromHash, saveLocal, loadLocal, saveCloud, loadCloud, addVersion, listVersions, deleteVersion, saveDraft, loadDraft, clearDraft, type DraftRow, type WorkbookMeta,
} from './store';
import FilesDialog from './files/FilesDialog';
import CollabDialog, { type CollabTab } from './collab/CollabDialog';
import * as collab from './collab/collabGlue';
import { ROLES } from './collab/share';
import { importFile } from './files/filesGlue';
import { snapHash, shouldCheckpoint, pruneList, SyncQueue } from './files/versions';
import AuthDialog from './AuthDialog';
import OpenDialog from './OpenDialog';
import RoadmapDialog from './RoadmapDialog';
import CellStylesDialog from './CellStylesDialog';
import { changeIndent } from './indent';
import FormulasDialog from './FormulasDialog';
import DataDialog from './DataDialog';
import ChartDialog from './charts/ChartDialog';
import ObjectsDialog from './objects/ObjectsDialog';
import PivotDialog from './pivot/PivotDialog';
import QueryDialog from './query/QueryDialog';
import ToolsDialog, { type ToolsTab } from './tools/ToolsDialog';
import Palette from './cmd/Palette';
import * as cmdGlue from './cmd/cmdGlue';
import * as autoGlue from './auto/autoGlue';
import * as a11yGlue from './a11y/a11yGlue';
import * as gallery from './gallery/galleryGlue';
import * as i18n from './i18n/i18nGlue';
import { buildSnapshot, byId as templateById } from './gallery/templates';
import { addResources, loadResources } from './persist';
import './pivot/pivotGlue';
import './query/queryGlue';
import { exportObjects, restoreObjects, OBJECTS_RESOURCE, type SavedObject } from './charts/chartGlue';

type Status = 'saved' | 'saving' | 'dirty' | 'pending';
type Snapshot = Record<string, unknown>;
const LAST_KEY = 'draco:last';

export default function App() {
  useSyncExternalStore(i18n.subscribe, i18n.version); const t = i18n.t;
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const timer = useRef<number>(0);
  const current = useRef({ id: '', title: 'Untitled workbook', cloud: false });
  const lastAuto = useRef<{ at?: string; hash?: string }>({});
  const mutN = useRef(0);
  const draftTimer = useRef<number>(0);
  const queue = useRef(new SyncQueue({ get: () => { try { return localStorage.getItem('draco:syncq'); } catch { return null; } }, set: (v) => { try { localStorage.setItem('draco:syncq', v); } catch { /* storage blocked */ } } }));
  const [recovery, setRecovery] = useState<DraftRow | null>(null);
  const [notice, setNotice] = useState('');
  const [title, setTitleState] = useState('Untitled workbook');
  const [cloud, setCloud] = useState(false);
  const [status, setStatus] = useState<Status>('saved');
  const [session, setSession] = useState<Session | null>(null);
  const [dialog, setDialog] = useState<null | 'open' | 'auth' | 'roadmap' | 'styles' | 'formulas' | 'data' | 'charts' | 'objects' | 'pivot' | 'query' | 'files' | 'print' | 'review' | 'tools'>(null);
  const [ttab, setTtab] = useState<ToolsTab>('macros'); const [palette, setPalette] = useState(false);
  const [rtab, setRtab] = useState<CollabTab>('comments');
  const openTools = (t: ToolsTab) => { setTtab(t); setDialog('tools'); setMenu(false); };
  const openReview = (t: CollabTab) => { setRtab(t); setDialog('review'); setMenu(false); };
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const cloudShareToken = useRef<string | null>(null);
  sessionRef.current = session;

  const listHas = (eng: NonNullable<typeof engine.current>, list: SavedObject[]) => { const wb = eng.api.getActiveWorkbook(); return list.every((o) => !!wb?.getSheetByName(o.sheet)?.getFloatDomById(o.id)); };
  const snapshot = (): Snapshot | null => {
    const wb = engine.current?.api.getActiveWorkbook();
    if (!wb) return null;
    const snap = wb.save() as unknown as Snapshot & { resources?: Array<{ name: string; data: string }> };
    const objs = exportObjects(engine.current!);
    snap.resources = (snap.resources ?? []).filter((r) => r.name !== OBJECTS_RESOURCE);
    if (objs.length) snap.resources.push({ name: OBJECTS_RESOURCE, data: JSON.stringify(objs) });
    addResources(snap);
    return snap;
  };

  const checkpoint = async (id: string, snap: Snapshot) => {
    try {
      const la = lastAuto.current; if (la.at && Date.now() - new Date(la.at).getTime() < 5 * 60_000) return;
      const h = snapHash(snap as never); if (!shouldCheckpoint(la.at, la.hash, h)) return;
      await addVersion(id, snap, 'Automatic checkpoint', 'auto', h); lastAuto.current = { at: new Date().toISOString(), hash: h };
      for (const v of pruneList(await listVersions(id), 30)) await deleteVersion(v.key);
    } catch { /* history is best-effort */ }
  };
  const flush = useCallback(async () => {
    const snap = snapshot();
    if (!snap) return;
    const { id, title, cloud } = current.current; cloudCtx.id = cloud && sessionRef.current ? id : null;
    const mark = mutN.current;
    setStatus('saving');
    try {
      if (cloudShareToken.current) { const okSave = await saveCloudShare(cloudShareToken.current, snap); if (!okSave) { cloudShareToken.current = null; setNotice('This link no longer allows editing; changes were not saved.'); } setStatus(okSave ? 'saved' : 'dirty'); return; }
      await saveLocal(id, title, snap, cloud);
      localStorage.setItem(LAST_KEY, JSON.stringify({ id, cloud }));
      if (mark === mutN.current) void clearDraft(id).catch(() => undefined);
      void checkpoint(id, snap);
      if (cloud && sessionRef.current) { try { await saveCloud(id, title, snap); queue.current.remove(id); } catch (err) { queue.current.add(id); throw err; } }
      setStatus('saved');
    } catch {
      setStatus(cloud ? 'pending' : 'dirty');
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setStatus('dirty');
    mutN.current++;
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => { const d = snapshot(); if (d) { const c = current.current; void saveDraft(c.id, c.title, d, c.cloud).catch(() => undefined); } }, 400);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 1200);
  }, [flush]);

  const mount = useCallback((id: string, name: string, isCloud: boolean, data?: Snapshot) => {
    const api = engine.current!.api;
    const old = api.getActiveWorkbook();
    if (old) api.disposeUnit(old.getId());
    current.current = { id, title: name, cloud: isCloud }; cloudCtx.id = isCloud && sessionRef.current ? id : null; cloudShareToken.current = null;
    setTitleState(name);
    setCloud(isCloud);
    const loc = data?.locale && data.locale !== 'zhCN' ? data.locale : 'enUS'; // engine default is Chinese; v98 adds a picker
    loadResources(data as never);
    api.createWorkbook({ ...(data ?? {}), locale: loc, id, name } as never);
    const saved = (data as { resources?: Array<{ name: string; data: string }> } | undefined)?.resources?.find((r) => r.name === OBJECTS_RESOURCE);
    if (saved) { try { const list = JSON.parse(saved.data) as SavedObject[]; const eng = engine.current!; const go = () => restoreObjects(eng, list); if (!go()) setTimeout(go, 400); setTimeout(() => { if (!listHas(eng, list)) go(); }, 1200); } catch { /* corrupt object list: skip */ } }
    setStatus('saved');
    localStorage.setItem(LAST_KEY, JSON.stringify({ id, cloud: isCloud }));
    lastAuto.current = {};
    if (data) void (async () => { try { const vs = await listVersions(id); const h = snapHash(data as never); if (!vs.length || vs[0].hash !== h) await addVersion(id, data, 'Opened', 'auto', h); lastAuto.current = { at: new Date().toISOString(), hash: h }; } catch { /* best-effort */ } })();
  }, []);

  const openMeta = useCallback(async (m: { id: string; source: 'local' | 'cloud' }) => {
    await flush();
    const rec = m.source === 'cloud' ? await loadCloud(m.id) : await loadLocal(m.id);
    if (!rec) return alert('Workbook not found.');
    mount(m.id, rec.title, m.source === 'cloud', rec.data);
    if (m.source === 'cloud') await saveLocal(m.id, rec.title, rec.data, true);
    setDialog(null);
  }, [flush, mount]);

  const newWorkbook = useCallback(async () => {
    await flush();
    const asCloud = Boolean(sessionRef.current);
    mount(newId(), 'Untitled workbook', asCloud);
    void flush();
    setMenu(false);
  }, [flush, mount]);

  // boot engine once
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    (async () => {
      const { bootEngine } = await import('./engine');
      if (cancelled || !host.current) return;
      engine.current = bootEngine(host.current, scheduleSave);
      (window as unknown as { dracoAPI: unknown }).dracoAPI = engine.current.api; // used by tests and, later, macros/scripting
      cmdGlue.init(engine.current); setReady(true);
      try {
        const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { id: string; cloud: boolean } | null;
        const rec = last ? await loadLocal(last.id) : null;
        const draft = last ? await loadDraft(last.id).catch(() => undefined) : undefined;
        if (last && rec) {
          mount(last.id, rec.title, last.cloud, rec.data);
          if (draft) { if (snapHash(draft.data as never) !== snapHash(rec.data as never) && draft.at > (await import('./store').then((m) => m.localUpdatedAt(last.id)) ?? '')) setRecovery(draft); else void clearDraft(last.id).catch(() => undefined); }
          return;
        }
        if (last && draft) { mount(last.id, draft.title, draft.cloud, draft.data); setNotice('Recovered your unsaved work from the last session.'); setTimeout(() => void flush(), 500); return; }
      } catch { /* fall through to blank */ }
      mount(newId(), 'Untitled workbook', false);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [mount, scheduleSave]);

  // collaboration wiring (v87-v92)
  const openTemplate = (id: string) => { const t = templateById(id); if (!t) return; const nid = newId(); mount(nid, t.title, false, buildSnapshot(t, nid) as unknown as Snapshot); setNotice(`Opened the “${t.title}” template as a new workbook.`); scheduleSave(); };
  useEffect(() => {
    autoGlue.setSaveHook(scheduleSave); autoGlue.setToast((m) => setNotice(m)); gallery.initTheme();
    cmdGlue.setApp({ open: (d, t) => { if (d === 'tools') { setTtab((t as ToolsTab) ?? 'macros'); setDialog('tools'); } else if (d === 'review') { setRtab((t as CollabTab) ?? 'comments'); setDialog('review'); } else if (d === 'files' && t === 'versions') setDialog('files'); else setDialog(d as never); }, save: () => void flush(), print: () => setDialog('print'), palette: () => setPalette(true), help: () => { setTtab('keys'); setDialog('tools'); } });
    return () => cmdGlue.dispose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    collab.setSaveHook(scheduleSave); collab.setMarkerClick((sheetId, r, c) => { collab.goToCell(sheetId, r, c); setRtab('comments'); setDialog('review'); });
    collab.configureSessions({ getSnapshot: () => { const s = snapshot(); return s ? { title: current.current.title, id: current.current.id, snap: s } : null; }, onJoin: (s, role) => { mount(s.id, s.title, false, s.snap as Snapshot); collab.setSaveHook(scheduleSave); void role; } });
  }, [scheduleSave]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return; void ROLES;
    (async () => {
      const ct = cloudTokenFromHash(location.hash);
      if (ct) { history.replaceState(null, '', location.pathname + location.search); try { const cs = await openCloudShare(ct); if (!cs) { setNotice('This share link is invalid, expired or was revoked.'); } else { mount(newId(), cs.title + ' (shared)', false, cs.data as Snapshot); setTimeout(() => { collab.setReadOnlyCopy(cs.role !== 'edit'); }, 600); cloudShareToken.current = cs.role === 'edit' ? ct : null; setNotice(cs.role === 'edit' ? 'Opened a shared workbook. Your edits are saved to the owner’s copy.' : `Opened a ${cs.role === 'view' ? 'view-only' : 'comment-only'} shared workbook.`); } } catch { setNotice('Could not open the share link. Check your connection.'); } return; }
      const sh = await collab.readShareFromHash();
      if (sh) { history.replaceState(null, '', location.pathname + location.search); mount(newId(), sh.title + ' (shared copy)', false, sh.snap as Snapshot); setTimeout(() => { collab.setReadOnlyCopy(sh.role !== 'edit'); }, 600); setNotice(sh.role === 'edit' ? 'Opened a shared copy.' : `Opened a ${sh.role === 'view' ? 'view-only' : 'comment-only'} shared copy.`); return; }
      const rm = collab.roomFromUrl(); if (rm) { history.replaceState(null, '', location.pathname); collab.joinSession(rm.room, rm.role); setNotice(`Joining live session ${rm.room}…`); }
    })();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // auth session
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // retry cloud sync when back online / after sign-in
  useEffect(() => {
    const retry = () => {
      if (current.current.cloud) void flush();
      if (sessionRef.current && queue.current.size()) void queue.current.process(async (qid) => { if (qid === current.current.id) return; const r = await loadLocal(qid); if (r) await saveCloud(qid, r.title, r.data); });
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [flush]);
  useEffect(() => { if (session && current.current.cloud) void flush(); }, [session, flush]);

  // save on tab hide / close
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void flush(); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setDialog('print'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

  const importIntoNew = useCallback(async (imp: { snap: Record<string, unknown>; title: string }) => {
    await flush();
    mount(newId(), imp.title, false, imp.snap as Snapshot);
    void flush();
  }, [flush, mount]);
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    const drop = async (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0]; if (!f || (e.target as HTMLElement | null)?.closest?.('.dropzone')) return; e.preventDefault();
      try { const imp = await importFile(f); await importIntoNew(imp); setNotice(imp.warnings.length ? `Opened "${imp.title}". ${imp.warnings.join(' ')}` : `Opened "${imp.title}".`); } catch (err) { setNotice((err as Error).message); }
    };
    window.addEventListener('dragover', over); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, [importIntoNew]);

  const rename = (t: string) => {
    const name = t.trim() || 'Untitled workbook';
    current.current.title = name;
    setTitleState(name);
    scheduleSave();
  };

  const moveToCloud = async () => {
    if (!session) return setDialog('auth');
    current.current.cloud = true;
    setCloud(true);
    setMenu(false);
    await flush();
  };

  const statusText = { saved: cloud && session ? 'Saved to cloud' : 'Saved on device', saving: 'Saving…', dirty: 'Unsaved changes', pending: 'Will sync when online' }[status];

  return (
    <div className="app">
      <a className="skip" href="#grid" onClick={(e) => { e.preventDefault(); a11yGlue.skipToGrid(); }}>{t('Skip to spreadsheet')}</a>
      <header className="topbar">
        <img src="/logo-128.png" srcSet="/logo-128.png 1x, /logo-256.png 2x" alt="Draco Sheets" className="logo" width={28} height={28} />
        <input
          className="title"
          aria-label="Workbook title"
          value={title}
          onChange={(e) => { setTitleState(e.target.value); }}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className={'status ' + status} aria-live="polite">{t(statusText)}</span>
        <nav className="actions">
          <button onClick={newWorkbook}>{t('New')}</button>
          <button onClick={() => setDialog('open')}>{t('Open')}</button>
          <button onClick={() => void flush()}>{t('Save')}</button>
          <button onClick={() => setDialog('styles')}>{t('Styles')}</button>
          <button onClick={() => setDialog('formulas')}>{t('Formulas')}</button>
          <button onClick={() => setDialog('data')}>{t('Data')}</button>
          <button onClick={() => setDialog('charts')}>{t('Charts')}</button>
          <button onClick={() => setDialog('objects')}>{t('Objects')}</button>
          <button onClick={() => setDialog('pivot')}>{t('PivotTable')}</button>
          <button onClick={() => setDialog('query')}>{t('Queries')}</button>
          <button onClick={() => setDialog('files')}>{t('Files')}</button>
          <button onClick={() => openReview('comments')} title="Comments, notes, share, changes, protect">{t('Review')}</button>
          <span className="pair" role="group" aria-label="Indent">
            <button title="Decrease indent" aria-label="Decrease indent" onClick={() => engine.current && void changeIndent(engine.current, -1)}>⇤</button>
            <button title="Increase indent" aria-label="Increase indent" onClick={() => engine.current && void changeIndent(engine.current, 1)}>⇥</button>
          </span>
          <button onClick={() => openTools('macros')} title="Macros, scripts, links, accessibility, language, templates, shortcuts">{t('Tools')}</button>
          {cloudEnabled && !cloud && <button onClick={moveToCloud}>{t('☁ Sync')}</button>}
          <button className="primary" onClick={() => setDialog('auth')}>{session ? (session.user.email ?? t('Account')).split('@')[0] : t('Sign in')}</button>
        </nav>
        <button className="icon burger" aria-label={t('Menu')} aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        {menu && (
          <div className="sheet" onClick={() => setMenu(false)}>
            <button onClick={newWorkbook}>{t('New workbook')}</button>
            <button onClick={() => setDialog('open')}>{t('Open…')}</button>
            <button onClick={() => void flush()}>{t('Save now')}</button>
            {cloudEnabled && !cloud && <button onClick={moveToCloud}>{t('Sync to cloud')}</button>}
            <button onClick={() => setDialog('styles')}>{t('Cell styles')}</button>
            <button onClick={() => setDialog('formulas')}>{t('Formulas')}</button>
            <button onClick={() => setDialog('data')}>{t('Data tools')}</button>
            <button onClick={() => setDialog('charts')}>{t('Charts')}</button>
            <button onClick={() => setDialog('objects')}>{t('Objects')}</button>
            <button onClick={() => setDialog('pivot')}>{t('PivotTable')}</button>
            <button onClick={() => setDialog('query')}>{t('Queries')}</button>
          <button onClick={() => setDialog('files')}>{t('Files')}</button>
            <button onClick={() => openReview('comments')}>{t('Review (comments, changes)')}</button>
            <button onClick={() => openReview('share')}>{t('Share & live session')}</button>
            <button onClick={() => openReview('protect')}>{t('Protect')}</button>
            <button onClick={() => engine.current && void changeIndent(engine.current, 1)}>{t('Increase indent')}</button>
            <button onClick={() => engine.current && void changeIndent(engine.current, -1)}>{t('Decrease indent')}</button>
            <button onClick={() => openTools('macros')}>{t('Tools (macros, scripts…)')}</button>
            <button onClick={() => openTools('templates')}>{t('Templates & themes')}</button>
            <button onClick={() => setPalette(true)}>{t('Command search')}</button>
            <button onClick={() => setDialog('roadmap')}>{t('Roadmap')}</button>
            <button onClick={() => setDialog('auth')}>{session ? t('Account') : t('Sign in')}</button>
          </div>
        )}
      </header>
      {recovery && <div className="banner" role="alert">Unsaved changes from {new Date(recovery.at).toLocaleTimeString()} were found after the last session.
        <button onClick={() => { const d = recovery; setRecovery(null); mount(d.id, d.title, d.cloud, d.data as Snapshot); void flush(); }}>Restore them</button>
        <button onClick={() => { void clearDraft(recovery.id).catch(() => undefined); setRecovery(null); }}>Discard</button></div>}
      {notice && <div className="banner" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">✕</button></div>}
      <div className="stage">
        <main ref={host} className="grid" />
        {!ready && <div className="splash" role="status"><div className="spin" /><span>Loading spreadsheet engine…</span></div>}
      </div>
      {dialog === 'open' && <OpenDialog signedIn={Boolean(session)} onOpen={(m: WorkbookMeta) => void openMeta(m)} onClose={() => setDialog(null)} />}
      {dialog === 'review' && engine.current && <CollabDialog tab={rtab} title={title} getSnapshot={() => snapshot()} onClose={() => setDialog(null)} />}
      {dialog === 'auth' && <AuthDialog session={session} onClose={() => setDialog(null)} />}
      {dialog === 'tools' && engine.current && <ToolsDialog engine={engine.current} tab={ttab} openTemplate={openTemplate} onRoadmap={() => setDialog('roadmap')} onClose={() => setDialog(null)} />}
      {palette && <Palette onClose={() => setPalette(false)} />}
      {dialog === 'roadmap' && <RoadmapDialog onClose={() => setDialog(null)} />}
      {dialog === 'data' && engine.current && <DataDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {dialog === 'pivot' && engine.current && <PivotDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {(dialog === 'files' || dialog === 'print') && engine.current && <FilesDialog engine={engine.current} tab={dialog === 'print' ? 'print' : 'files'} onClose={() => setDialog(null)} ctx={{ id: current.current.id, title: current.current.title, getSnapshot: () => snapshot() as never, onImport: (imp) => void importIntoNew(imp), onRestore: (snap) => { mount(current.current.id, current.current.title, current.current.cloud, snap as unknown as Snapshot); void flush(); }, onSetupChanged: scheduleSave, markCheckpoint: (h) => { lastAuto.current = { at: new Date().toISOString(), hash: h }; } }} />}
      {dialog === 'query' && engine.current && <QueryDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {dialog === 'objects' && engine.current && <ObjectsDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {dialog === 'charts' && engine.current && <ChartDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {dialog === 'formulas' && engine.current && <FormulasDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {dialog === 'styles' && <CellStylesDialog engine={engine.current} onClose={() => setDialog(null)} />}
    </div>
  );
}

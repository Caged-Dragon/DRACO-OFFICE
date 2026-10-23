import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Engine } from './engine';
import { supabase, cloudEnabled } from './supabase';
import {
  newId, saveLocal, loadLocal, saveCloud, loadCloud, type WorkbookMeta,
} from './store';
import AuthDialog from './AuthDialog';
import OpenDialog from './OpenDialog';
import RoadmapDialog from './RoadmapDialog';
import CellStylesDialog from './CellStylesDialog';
import { changeIndent } from './indent';
import FormulasDialog from './FormulasDialog';

type Status = 'saved' | 'saving' | 'dirty' | 'pending';
type Snapshot = Record<string, unknown>;
const LAST_KEY = 'draco:last';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const timer = useRef<number>(0);
  const current = useRef({ id: '', title: 'Untitled workbook', cloud: false });
  const [title, setTitleState] = useState('Untitled workbook');
  const [cloud, setCloud] = useState(false);
  const [status, setStatus] = useState<Status>('saved');
  const [session, setSession] = useState<Session | null>(null);
  const [dialog, setDialog] = useState<null | 'open' | 'auth' | 'roadmap' | 'styles' | 'formulas'>(null);
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const snapshot = (): Snapshot | null => {
    const wb = engine.current?.api.getActiveWorkbook();
    return wb ? (wb.save() as unknown as Snapshot) : null;
  };

  const flush = useCallback(async () => {
    const snap = snapshot();
    if (!snap) return;
    const { id, title, cloud } = current.current;
    setStatus('saving');
    try {
      await saveLocal(id, title, snap, cloud);
      localStorage.setItem(LAST_KEY, JSON.stringify({ id, cloud }));
      if (cloud && sessionRef.current) await saveCloud(id, title, snap);
      setStatus('saved');
    } catch {
      setStatus(cloud ? 'pending' : 'dirty');
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setStatus('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 1200);
  }, [flush]);

  const mount = useCallback((id: string, name: string, isCloud: boolean, data?: Snapshot) => {
    const api = engine.current!.api;
    const old = api.getActiveWorkbook();
    if (old) api.disposeUnit(old.getId());
    current.current = { id, title: name, cloud: isCloud };
    setTitleState(name);
    setCloud(isCloud);
    const loc = data?.locale && data.locale !== 'zhCN' ? data.locale : 'enUS'; // engine default is Chinese; v98 adds a picker
    api.createWorkbook({ ...(data ?? {}), locale: loc, id, name } as never);
    setStatus('saved');
    localStorage.setItem(LAST_KEY, JSON.stringify({ id, cloud: isCloud }));
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
      setReady(true);
      try {
        const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { id: string; cloud: boolean } | null;
        const rec = last ? await loadLocal(last.id) : null;
        if (last && rec) return mount(last.id, rec.title, last.cloud, rec.data);
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

  // auth session
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // retry cloud sync when back online / after sign-in
  useEffect(() => {
    const retry = () => { if (current.current.cloud) void flush(); };
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

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
      <header className="topbar">
        <img src="/icon.svg" alt="" className="logo" width={28} height={28} />
        <input
          className="title"
          aria-label="Workbook title"
          value={title}
          onChange={(e) => { setTitleState(e.target.value); }}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className={'status ' + status} aria-live="polite">{statusText}</span>
        <nav className="actions">
          <button onClick={newWorkbook}>New</button>
          <button onClick={() => setDialog('open')}>Open</button>
          <button onClick={() => void flush()}>Save</button>
          <button onClick={() => setDialog('styles')}>Styles</button>
          <button onClick={() => setDialog('formulas')}>Formulas</button>
          <span className="pair" role="group" aria-label="Indent">
            <button title="Decrease indent" aria-label="Decrease indent" onClick={() => engine.current && void changeIndent(engine.current, -1)}>⇤</button>
            <button title="Increase indent" aria-label="Increase indent" onClick={() => engine.current && void changeIndent(engine.current, 1)}>⇥</button>
          </span>
          <button onClick={() => setDialog('roadmap')}>Roadmap</button>
          {cloudEnabled && !cloud && <button onClick={moveToCloud}>☁ Sync</button>}
          <button className="primary" onClick={() => setDialog('auth')}>{session ? (session.user.email ?? 'Account').split('@')[0] : 'Sign in'}</button>
        </nav>
        <button className="icon burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        {menu && (
          <div className="sheet" onClick={() => setMenu(false)}>
            <button onClick={newWorkbook}>New workbook</button>
            <button onClick={() => setDialog('open')}>Open…</button>
            <button onClick={() => void flush()}>Save now</button>
            {cloudEnabled && !cloud && <button onClick={moveToCloud}>Sync to cloud</button>}
            <button onClick={() => setDialog('styles')}>Cell styles</button>
            <button onClick={() => setDialog('formulas')}>Formulas</button>
            <button onClick={() => engine.current && void changeIndent(engine.current, 1)}>Increase indent</button>
            <button onClick={() => engine.current && void changeIndent(engine.current, -1)}>Decrease indent</button>
            <button onClick={() => setDialog('roadmap')}>Roadmap</button>
            <button onClick={() => setDialog('auth')}>{session ? 'Account' : 'Sign in'}</button>
          </div>
        )}
      </header>
      <div className="stage">
        <main ref={host} className="grid" />
        {!ready && <div className="splash" role="status"><div className="spin" /><span>Loading spreadsheet engine…</span></div>}
      </div>
      {dialog === 'open' && <OpenDialog signedIn={Boolean(session)} onOpen={(m: WorkbookMeta) => void openMeta(m)} onClose={() => setDialog(null)} />}
      {dialog === 'auth' && <AuthDialog session={session} onClose={() => setDialog(null)} />}
      {dialog === 'roadmap' && <RoadmapDialog onClose={() => setDialog(null)} />}
      {dialog === 'formulas' && engine.current && <FormulasDialog engine={engine.current} onClose={() => setDialog(null)} />}
      {dialog === 'styles' && <CellStylesDialog engine={engine.current} onClose={() => setDialog(null)} />}
    </div>
  );
}

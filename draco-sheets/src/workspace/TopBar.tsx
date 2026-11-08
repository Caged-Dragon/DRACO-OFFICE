import type { Session } from '@supabase/supabase-js';
import type { Engine } from '../engine';
import { cloudEnabled } from '../supabase';
import { changeIndent } from '../indent';
import ThemeToggle from '../site/ThemeToggle';
import type { CollabTab } from '../collab/CollabDialog';
import type { ToolsTab } from '../tools/ToolsDialog';
import { goTo } from './navigate';

export type DialogId = null | 'open' | 'auth' | 'roadmap' | 'styles' | 'formulas' | 'data' | 'charts' | 'objects' | 'pivot' | 'query' | 'files' | 'print' | 'review' | 'tools';

/** Title bar: logo, workbook title, save status, quick actions, sign-in and the compact menu. */
export interface TopBarProps {
  t: (s: string) => string; title: string; setTitle: (v: string) => void; rename: (v: string) => void; status: string; statusText: string;
  flush: () => Promise<unknown>; newWorkbook: () => void | Promise<void>; setDialog: (d: DialogId) => void; openReview: (t: CollabTab) => void; openTools: (t: ToolsTab) => void;
  engine: Engine | null; cloud: boolean; moveToCloud: () => void | Promise<void>; session: Session | null; menu: boolean; setMenu: (v: boolean) => void; setPalette: (v: boolean) => void;
}
export default function TopBar({ t, title, setTitle, rename, status, statusText, flush, newWorkbook, setDialog, openReview, openTools, engine, cloud, moveToCloud, session, menu, setMenu, setPalette }: TopBarProps) {
  return (
  <header className="topbar">
    <a href="/home" className="logo-link" title="Back to Start" aria-label="Back to the start screen" onClick={(e) => { e.preventDefault(); void flush().then(() => goTo('/home')); }}><img src="/logo-128.png" srcSet="/logo-128.png 1x, /logo-256.png 2x" alt="Draco Sheets" className="logo" width={28} height={28} /></a>
    <input
      className="title"
      aria-label="Workbook title"
      value={title}
      onChange={(e) => { setTitle(e.target.value); }}
      onBlur={(e) => rename(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
    <span className={'status ' + status} aria-live="polite">{t(statusText)}</span>
    <nav className="actions">
      <button onClick={newWorkbook}>{t('New')}</button>
      <button onClick={() => setDialog('open')}>{t('Open')}</button>
      <button onClick={() => void flush()}>{t('Save')}</button>
      <button onClick={() => openReview('comments')} title="Comments, notes, share, changes, protect">{t('Review')}</button>
      <span className="pair" role="group" aria-label="Indent">
        <button title="Decrease indent" aria-label="Decrease indent" onClick={() => engine && void changeIndent(engine, -1)}>⇤</button>
        <button title="Increase indent" aria-label="Increase indent" onClick={() => engine && void changeIndent(engine, 1)}>⇥</button>
      </span>
      <button onClick={() => openTools('macros')} title="Macros, scripts, links, accessibility, language, templates, shortcuts">{t('Tools')}</button>
      {cloudEnabled && !cloud && <button onClick={moveToCloud}>{t('☁ Sync')}</button>}
      <ThemeToggle className="tt" />
      <button title="Settings" aria-label="Settings" onClick={() => { void flush().then(() => goTo('/settings')); }}>⚙</button>
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
        <button onClick={() => engine && void changeIndent(engine, 1)}>{t('Increase indent')}</button>
        <button onClick={() => engine && void changeIndent(engine, -1)}>{t('Decrease indent')}</button>
        <button onClick={() => openTools('macros')}>{t('Tools (macros, scripts…)')}</button>
        <button onClick={() => openTools('templates')}>{t('Templates & themes')}</button>
        <button onClick={() => setPalette(true)}>{t('Command search')}</button>
        <button onClick={() => setDialog('auth')}>{session ? t('Account') : t('Sign in')}</button>
      </div>
    )}
  </header>
  );
}

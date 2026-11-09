import type { Session } from '@supabase/supabase-js';
import type { Engine } from '../core/engine';
import SideMenu from './SideMenu';
import ThemeToggle from '../site/ThemeToggle';
import type { CollabTab } from '../collab/CollabDialog';
import type { ToolsTab } from '../tools/ToolsDialog';
import { goTo } from './navigate';

export type DialogId =
  | null
  | 'open'
  | 'auth'
  | 'roadmap'
  | 'styles'
  | 'formulas'
  | 'data'
  | 'charts'
  | 'objects'
  | 'pivot'
  | 'query'
  | 'files'
  | 'print'
  | 'review'
  | 'tools'
  | 'find'
  | 'replace';

/** Title bar: logo, workbook title, save status, quick actions, sign-in and the compact menu. */
export interface TopBarProps {
  t: (s: string) => string;
  title: string;
  setTitle: (v: string) => void;
  rename: (v: string) => void;
  status: string;
  statusText: string;
  flush: () => Promise<unknown>;
  newWorkbook: () => void | Promise<void>;
  setDialog: (d: DialogId) => void;
  openReview: (t: CollabTab) => void;
  openTools: (t: ToolsTab) => void;
  engine: Engine | null;
  cloud: boolean;
  moveToCloud: () => void | Promise<void>;
  session: Session | null;
  menu: boolean;
  setMenu: (v: boolean) => void;
  setPalette: (v: boolean) => void;
}
export default function TopBar(p: TopBarProps) {
  const { t, title, setTitle, rename, status, statusText, flush, setDialog, session, menu, setMenu } = p;
  return (
    <header className="topbar">
      <button
        className="burger icon"
        aria-label={t('Menu')}
        aria-expanded={menu}
        aria-haspopup="dialog"
        title={t('Menu')}
        onClick={() => setMenu(!menu)}
      >
        ☰
      </button>
      <a
        href="/home"
        className="logo-link"
        title="Back to Start"
        aria-label="Back to the start screen"
        onClick={(e) => {
          e.preventDefault();
          void flush().then(() => goTo('/home'));
        }}
      >
        <img
          src="/logo-128.png"
          srcSet="/logo-128.png 1x, /logo-256.png 2x"
          alt="Draco Sheets"
          className="logo"
          width={28}
          height={28}
        />
      </a>
      <input
        className="title"
        aria-label="Workbook title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
        onBlur={(e) => rename(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className={'status ' + status} aria-live="polite">
        {t(statusText)}
      </span>
      <nav className="actions">
        <ThemeToggle className="tt" />
        <button className="primary" onClick={() => setDialog('auth')}>
          {session ? (session.user.email ?? t('Account')).split('@')[0] : t('Sign in')}
        </button>
      </nav>
      {menu && <SideMenu {...p} />}
    </header>
  );
}

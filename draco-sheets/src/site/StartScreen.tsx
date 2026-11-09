import { useEffect, useMemo, useState } from 'react';
import { TEMPLATES } from '../gallery/templates';
import { listLocal, type WorkbookMeta } from '../core/store';
import ThemeToggle from './ThemeToggle';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d)
    ? ''
    : d.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
      });
};

/** Excel-style start screen: greeting, New row (blank + templates) and a recent files list. */
export default function StartScreen({ go }: { go: (to: string) => void }) {
  const [recent, setRecent] = useState<WorkbookMeta[]>([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'recent' | 'templates'>('recent');
  const [all, setAll] = useState(false);
  useEffect(() => {
    void listLocal()
      .then((l) => setRecent([...l].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))))
      .catch(() => setRecent([]));
  }, []);
  const shown = useMemo(() => recent.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())), [recent, q]);
  const tpl = TEMPLATES.filter((t) => `${t.title} ${t.blurb} ${t.category}`.toLowerCase().includes(q.toLowerCase()));
  const newRow = all ? TEMPLATES : TEMPLATES.slice(0, 5);
  return (
    <div className="st">
      <aside className="st-side" aria-label="Start">
        <img className="st-logo" src="/logo-128.png" alt="Draco Sheets" width="44" height="44" />
        <button className="on" onClick={() => go('/home')}>
          <span aria-hidden>⌂</span>Home
        </button>
        <button onClick={() => go('/app?new=1')}>
          <span aria-hidden>＋</span>New
        </button>
        <button onClick={() => go('/app?open=1')}>
          <span aria-hidden>🗁</span>Open
        </button>
        <div className="st-sp" />
        <button onClick={() => go('/app?account=1')}>
          <span aria-hidden>👤</span>Account
        </button>
        <button onClick={() => go('/settings')}>
          <span aria-hidden>⚙</span>Settings
        </button>
        <button onClick={() => go('/')}>
          <span aria-hidden>↩</span>Website
        </button>
      </aside>
      <main className="st-main">
        <div className="st-top">
          <h1>{greet()}</h1>
          <div className="st-tools">
            <ThemeToggle />
            <button className="st-set" onClick={() => go('/settings')}>
              ⚙ Settings
            </button>
          </div>
        </div>
        <div className="st-head">
          <h2>New</h2>
          <button className="st-link" onClick={() => setAll(!all)}>
            {all ? 'Fewer templates' : 'More templates →'}
          </button>
        </div>
        <div className="st-new" role="list">
          <button role="listitem" className="st-card blank" onClick={() => go('/app?new=1')}>
            <div className="st-thumb">
              <div className="mini">
                <i />
                <i />
                <i />
                <b />
                <b />
                <b />
              </div>
            </div>
            <span>Blank workbook</span>
          </button>
          {newRow.map((t) => (
            <button
              role="listitem"
              key={t.id}
              className="st-card"
              onClick={() => go(`/app?template=${encodeURIComponent(t.id)}`)}
              title={t.blurb}
            >
              <div className="st-thumb tpl">
                <b>{t.category}</b>
                <em>{t.title.slice(0, 2).toUpperCase()}</em>
              </div>
              <span>{t.title}</span>
            </button>
          ))}
        </div>
        <div className="st-bar">
          <div className="st-pills" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'recent'}
              className={tab === 'recent' ? 'on' : ''}
              onClick={() => setTab('recent')}
            >
              Recent
            </button>
            <button
              role="tab"
              aria-selected={tab === 'templates'}
              className={tab === 'templates' ? 'on' : ''}
              onClick={() => setTab('templates')}
            >
              All templates
            </button>
          </div>
          <label className="st-search">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              placeholder="Search for a file"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search"
            />
          </label>
        </div>
        {tab === 'recent' ? (
          <div className="st-list">
            <div className="st-lh">
              <span>Name</span>
              <span>Date modified</span>
            </div>
            {shown.length === 0 ? (
              <p className="st-empty">
                {recent.length
                  ? 'No file matches that search.'
                  : 'Nothing here yet. Start a blank workbook or pick a template — your files are listed here.'}
              </p>
            ) : (
              shown.map((r) => (
                <button
                  key={r.source + r.id}
                  className="st-row"
                  onClick={() => go(`/app?open=${encodeURIComponent(r.id)}&src=${r.source}`)}
                >
                  <span className="nm">
                    <b>{r.title || 'Untitled workbook'}</b>
                    <small>{r.source === 'cloud' ? 'Cloud' : 'On this device'}</small>
                  </span>
                  <span>{when(r.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="st-grid">
            {tpl.map((t) => (
              <button key={t.id} className="st-tcard" onClick={() => go(`/app?template=${encodeURIComponent(t.id)}`)}>
                <small>{t.category}</small>
                <b>{t.title}</b>
                <span>{t.blurb}</span>
              </button>
            ))}
            {tpl.length === 0 && <p className="st-empty">No template matches that search.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

import React, { Suspense, lazy, useEffect, useState } from 'react';
import StartScreen from './StartScreen';
import Settings from './Settings';
import ThemeToggle from './ThemeToggle';
import './styles/pages.css';
import './styles/toggle.css';
import './styles/settings.css';
import './styles/start.css';
import { A, go } from './components/Link';
import Home from './pages/Home';
import Features from './pages/Features';
import Templates from './pages/Templates';
import Shortcuts from './pages/Shortcuts';
import About from './pages/About';
import NotFound from './pages/NotFound';

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';
const App = lazy(() => import('../App'));
export const PAGES = [
  { path: '/', label: 'Home' }, { path: '/features', label: 'Features' }, { path: '/templates', label: 'Templates' },
  { path: '/shortcuts', label: 'Shortcuts' }, { path: '/about', label: 'About' },
] as const;

export default function Site() {
  const [path, setPath] = useState(norm(location.pathname));
  useEffect(() => { const f = () => setPath(norm(location.pathname)); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  const isApp = path === '/app' || path.startsWith('/app/');
  useEffect(() => { const t = PAGES.find((p) => p.path === path) ?? (path === '/settings' ? { path, label: 'Settings' } : path === '/home' ? { path, label: 'Start' } : undefined); document.title = isApp ? 'Draco Sheets — Workbook' : t && t.path !== '/' ? `${t.label} · Draco Sheets` : 'Draco Sheets — a spreadsheet for the web'; }, [path, isApp]);
  if (isApp) return <Suspense fallback={<div className="boot">Loading Draco Sheets…</div>}><App /></Suspense>;
  if (path === '/home') return <StartScreen go={go} />;
  return (
    <div className="site">
      <header className="s-nav"><div className="s-wrap s-nav-in">
        <A to="/" className="s-brand"><img src="/logo-128.png" alt="" width="32" height="32" /><span>Draco Sheets</span></A>
        <nav aria-label="Main">{PAGES.map((p) => <A key={p.path} to={p.path} className={p.path === path ? 'on' : ''}>{p.label}</A>)}</nav>
        <div className="s-tools"><ThemeToggle /><A to="/settings" className="s-set-btn" aria-label="Settings">⚙ <span>Settings</span></A><A to="/home" className="s-btn s-btn-go">Open the app</A></div>
      </div></header>
      <main>{path === '/features' ? <Features /> : path === '/templates' ? <Templates /> : path === '/shortcuts' ? <Shortcuts /> : path === '/settings' ? <Settings /> : path === '/about' ? <About /> : path === '/' ? <Home /> : <NotFound />}</main>
      <footer className="s-foot"><div className="s-wrap s-foot-in">
        <div><div className="s-brand"><img src="/logo-128.png" alt="" width="28" height="28" /><span>Draco Sheets</span></div><p>A spreadsheet that runs in your browser.</p><div className="s-co"><img src="/company-128.png" alt="Caged Dragon Studios" width="64" height="64" /><span>A product of<br />Caged Dragon Studios</span></div></div>
        <div><h4>Product</h4><A to="/features">Features</A><A to="/templates">Templates</A><A to="/home">Open the app</A></div>
        <div><h4>Learn</h4><A to="/shortcuts">Shortcuts</A><A to="/settings">Settings</A><A to="/about">About</A></div>
      </div><div className="s-wrap s-copy">© {new Date().getFullYear()} Caged Dragon Studios. Unleash possibilities.</div></footer>
    </div>
  );
}


import React, { Suspense, lazy, useEffect, useState } from 'react';
import { TEMPLATES } from '../gallery/templates';
import versions from '../versions.json';
import './site.css';

const App = lazy(() => import('../App'));
export const PAGES = [
  { path: '/', label: 'Home' }, { path: '/features', label: 'Features' }, { path: '/templates', label: 'Templates' },
  { path: '/shortcuts', label: 'Shortcuts' }, { path: '/roadmap', label: 'Roadmap' }, { path: '/about', label: 'About' },
] as const;

export function go(to: string) { if (location.pathname === to) return; history.pushState(null, '', to); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); }
function A({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); go(to); }}>{children}</a>;
}
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

export default function Site() {
  const [path, setPath] = useState(norm(location.pathname));
  useEffect(() => { const f = () => setPath(norm(location.pathname)); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  const isApp = path === '/app' || path.startsWith('/app/');
  useEffect(() => { const t = PAGES.find((p) => p.path === path); document.title = isApp ? 'Draco Sheets — Workbook' : t && t.path !== '/' ? `${t.label} · Draco Sheets` : 'Draco Sheets — a spreadsheet for the web'; }, [path, isApp]);
  if (isApp) return <Suspense fallback={<div className="boot">Loading Draco Sheets…</div>}><App /></Suspense>;
  return (
    <div className="site">
      <header className="s-nav"><div className="s-wrap s-nav-in">
        <A to="/" className="s-brand"><img src="/logo-128.png" alt="" width="32" height="32" /><span>Draco Sheets</span></A>
        <nav aria-label="Main">{PAGES.map((p) => <A key={p.path} to={p.path} className={p.path === path ? 'on' : ''}>{p.label}</A>)}</nav>
        <A to="/app" className="s-btn s-btn-go">Open the app</A>
      </div></header>
      <main>{path === '/features' ? <Features /> : path === '/templates' ? <Templates /> : path === '/shortcuts' ? <Shortcuts /> : path === '/roadmap' ? <Roadmap /> : path === '/about' ? <About /> : path === '/' ? <Home /> : <NotFound />}</main>
      <footer className="s-foot"><div className="s-wrap s-foot-in">
        <div><div className="s-brand"><img src="/logo-128.png" alt="" width="28" height="28" /><span>Draco Sheets</span></div><p>A spreadsheet that runs in your browser. Built by Caged Dragon Studios.</p></div>
        <div><h4>Product</h4><A to="/features">Features</A><A to="/templates">Templates</A><A to="/app">Open the app</A></div>
        <div><h4>Learn</h4><A to="/shortcuts">Shortcuts</A><A to="/roadmap">Roadmap</A><A to="/about">About</A></div>
      </div><div className="s-wrap s-copy">© {new Date().getFullYear()} Caged Dragon Studios</div></footer>
    </div>
  );
}

function Home() {
  const rows = [['Item', 'Units', 'Price', 'Total'], ['Widgets', '12', '4.50', '54.00'], ['Gadgets', '7', '9.25', '64.75'], ['Gizmos', '20', '2.10', '42.00'], ['Total', '39', '', '160.75']];
  return (<>
    <section className="s-hero"><div className="s-wrap s-hero-in">
      <div><p className="s-eyebrow">Spreadsheets, rebuilt for the web</p>
        <h1>The spreadsheet that opens in a tab and works like the one you know.</h1>
        <p className="s-lead">Formulas, charts, pivot tables, Excel-style tables, data validation and real .xlsx import and export — with no install and nothing to sign up for.</p>
        <div className="s-cta"><A to="/app" className="s-btn s-btn-go s-lg">Start a blank workbook</A><A to="/templates" className="s-btn s-lg">Browse templates</A></div></div>
      <div className="s-mock" aria-hidden="true"><div className="s-mock-bar"><i /><i /><i /><span>Q4 sales.xlsx</span></div>
        <table><tbody>{rows.map((r, i) => <tr key={i} className={i === 0 ? 'h' : i === rows.length - 1 ? 't' : ''}><th>{i + 1}</th>{r.map((c, j) => <td key={j} className={j > 0 ? 'n' : ''}>{c}</td>)}</tr>)}</tbody></table>
        <div className="s-bars">{[40, 62, 48, 80, 66].map((h, i) => <b key={i} style={{ height: h }} />)}</div></div>
    </div></section>
    <section className="s-sec"><div className="s-wrap"><h2>Everything in one place</h2>
      <div className="s-grid3">{FEATS.slice(0, 6).map((f) => <article key={f.t} className="s-card"><div className="s-ic">{f.i}</div><h3>{f.t}</h3><p>{f.d}</p></article>)}</div>
      <p className="s-more"><A to="/features">See every feature →</A></p></div></section>
    <section className="s-sec s-alt"><div className="s-wrap s-split">
      <div><h2>Bring your Excel files</h2><p>Open an .xlsx and keep your formatting, formulas, merged cells and tables. Save back to .xlsx with real Excel tables and native charts, so the file keeps working in Excel.</p><A to="/app" className="s-btn s-btn-go">Try it with a file</A></div>
      <ul className="s-ticks"><li>Reads and writes .xlsx, .csv and .ods</li><li>Excel tables survive the round trip</li><li>Column, bar, line, area, pie and scatter charts export as native Excel charts</li><li>Share by link, view-only or editable</li></ul></div></section>
    <section className="s-sec"><div className="s-wrap s-cta-band"><h2>Ready when you are</h2><A to="/app" className="s-btn s-btn-go s-lg">Open Draco Sheets</A></div></section>
  </>);
}

const FEATS = [
  { i: 'ƒx', t: 'Formulas', d: 'Hundreds of functions, dynamic arrays and spill, named ranges, and trace precedents and dependents arrows.' },
  { i: '▥', t: 'Charts', d: 'Column, bar, line, area, pie, doughnut, scatter and more, with titles, legends, trendlines and a second axis.' },
  { i: '⊞', t: 'Pivot tables', d: 'Drag fields into rows, columns, values and filters, with slicers and refresh.' },
  { i: '▦', t: 'Tables', d: 'Named tables with banded rows, total rows, structured references, auto-expand and table slicers.' },
  { i: '✓', t: 'Data tools', d: 'Validation with circle-invalid, filters, sort, remove duplicates, text to columns and Power Query-style steps.' },
  { i: '⇄', t: 'Collaboration', d: 'Live sessions, comments, share links with view, comment or edit roles, and cloud save when signed in.' },
  { i: '⎙', t: 'Print and export', d: 'Page setup, print areas and headers, PDF output, and .xlsx, .csv or .ods export.' },
  { i: '∑', t: 'Analysis ToolPak', d: 'Descriptive statistics, regression, t-tests, ANOVA, correlation, histograms and moving averages.' },
  { i: '⌘', t: 'Command search', d: 'Press Ctrl+K to find any command, and use the keyboard for nearly everything.' },
  { i: '♿', t: 'Accessible', d: 'Keyboard navigation, screen-reader labels, high-contrast support and dark mode.' },
  { i: '🌐', t: 'Multiple languages', d: 'Interface and function names in several languages, with locale-aware number formats.' },
  { i: '▶', t: 'Macros', d: 'Record and edit macros to repeat routine work.' },
];
function Features() { return (<><PageHead t="Features" d="What you can do in Draco Sheets today." /><section className="s-sec"><div className="s-wrap s-grid3">{FEATS.map((f) => <article key={f.t} className="s-card"><div className="s-ic">{f.i}</div><h3>{f.t}</h3><p>{f.d}</p></article>)}</div>
  <div className="s-wrap"><div className="s-note"><h3>What it does not do yet</h3><p>Manual and iterative calculation, outline grouping, right-to-left grids, native Excel pivot tables on export and reading charts back from .xlsx are not available. See the <A to="/roadmap">roadmap</A>.</p></div></div></section></>); }

function Templates() {
  const cats = ['Personal', 'Business', 'School', 'Planning'] as const;
  return (<><PageHead t="Templates" d="Start from a ready-made workbook. Open the app and choose a template from File → New from template." />
    <section className="s-sec"><div className="s-wrap">{cats.map((c) => { const l = TEMPLATES.filter((t) => t.category === c); return l.length ? <div key={c}><h2 className="s-h2">{c}</h2><div className="s-grid3">{l.map((t) => <article key={t.id} className="s-card"><h3>{t.title}</h3><p>{t.blurb}</p><small>{t.sheets.length} sheet{t.sheets.length === 1 ? '' : 's'}</small></article>)}</div></div> : null; })}
      <p className="s-more"><A to="/app" className="s-btn s-btn-go">Open the app</A></p></div></section></>);
}

function Shortcuts() {
  const S: Array<[string, string]> = [['Ctrl + C / X / V', 'Copy, cut, paste'], ['Ctrl + Z / Y', 'Undo, redo'], ['Ctrl + F / H', 'Find, replace'], ['Ctrl + K', 'Command search'], ['Ctrl + B / I / U', 'Bold, italic, underline'], ['Ctrl + ;', 'Insert today’s date'], ['Ctrl + Arrow', 'Jump to the edge of data'], ['Ctrl + Shift + Arrow', 'Select to the edge of data'], ['Ctrl + A', 'Select all'], ['F2', 'Edit the active cell'], ['F4', 'Toggle absolute and relative references'], ['Alt + =', 'AutoSum'], ['Ctrl + Enter', 'Fill the selection with the entry'], ['Shift + Space / Ctrl + Space', 'Select row, select column']];
  return (<><PageHead t="Keyboard shortcuts" d="The usual spreadsheet keys work here." /><section className="s-sec"><div className="s-wrap s-narrow"><table className="s-keys"><tbody>{S.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table><p className="s-muted">On a Mac, use Cmd in place of Ctrl.</p></div></section></>);
}

function Roadmap() {
  const v = versions as Array<{ v: number | string; title: string; phase: string; status: string }>; const done = v.filter((x) => x.status === 'done').length;
  const phases = [...new Set(v.map((x) => x.phase))];
  return (<><PageHead t="Roadmap" d={`${done} of ${v.length} planned items are complete.`} /><section className="s-sec"><div className="s-wrap s-narrow"><div className="s-bar" role="progressbar" aria-valuenow={done} aria-valuemax={v.length}><i style={{ width: `${(100 * done) / v.length}%` }} /></div>
    {phases.map((p) => <details key={p} className="s-ph"><summary>{p} <span>{v.filter((x) => x.phase === p && x.status === 'done').length}/{v.filter((x) => x.phase === p).length}</span></summary><ul>{v.filter((x) => x.phase === p).map((x) => <li key={String(x.v)} className={x.status}><b>{x.v}</b> {x.title}</li>)}</ul></details>)}</div></section></>);
}

function About() {
  return (<><PageHead t="About" d="Draco Sheets is made by Caged Dragon Studios." /><section className="s-sec"><div className="s-wrap s-narrow s-prose">
    <p>Draco Sheets is a spreadsheet for the browser. The goal is simple: the things you reach for in a desktop spreadsheet should be here, without an install.</p>
    <p>Your workbooks are stored in your browser. If you sign in, they can also be saved to the cloud and shared by link. Files you open are processed on your device.</p>
    <p>It is under active development, so some Excel features are still missing; the <A to="/roadmap">roadmap</A> and <A to="/features">features</A> pages say which.</p>
    <p><A to="/app" className="s-btn s-btn-go">Open the app</A></p></div></section></>);
}
function NotFound() { return <><PageHead t="Page not found" d="That page does not exist." /><section className="s-sec"><div className="s-wrap"><A to="/" className="s-btn s-btn-go">Go home</A></div></section></>; }
function PageHead({ t, d }: { t: string; d: string }) { return <section className="s-phead"><div className="s-wrap"><h1>{t}</h1><p className="s-lead">{d}</p></div></section>; }

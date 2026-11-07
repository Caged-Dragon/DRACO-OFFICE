import { useEffect, useState, useSyncExternalStore } from 'react';
import { THEMES } from '../gallery/themes';
import { applyTheme, getTheme } from '../gallery/galleryGlue';
import * as a11y from '../a11y/a11yGlue';
import { REGIONS } from '../i18n/regional';
import { backendConfigured, health } from '../backend/client';

/** Settings page: appearance, accessibility, region. Everything saves to this device straight away. */
export default function Settings() {
  const [theme, setTheme] = useState(getTheme());
  useEffect(() => { const f = () => setTheme(getTheme()); window.addEventListener('draco-theme', f); return () => window.removeEventListener('draco-theme', f); }, []);
  const ver = useSyncExternalStore(a11y.subscribe ?? (() => () => undefined), () => a11y.version?.() ?? 0);
  void ver; const cur = a11y.get();
  const regions = REGIONS; const [region, setReg] = useState('');
  useEffect(() => { void import('../i18n/i18nGlue').then((m) => { setReg(m.getRegion().id); }); }, []);
  const [server, setServer] = useState<string>(backendConfigured() ? 'Checking…' : 'Not connected');
  useEffect(() => { if (!backendConfigured()) return; void health().then((h) => setServer(h ? (h.convert ? 'Connected — file conversion and statistics available' : 'Connected — statistics only (LibreOffice missing)') : 'Not reachable')); }, []);
  const [saved, setSaved] = useState('');
  const flash = (m: string) => { setSaved(m); window.setTimeout(() => setSaved(''), 1600); };
  return (<>
    <section className="s-phead"><div className="s-wrap"><h1>Settings</h1><p className="s-lead">Changes save on this device straight away.</p></div></section>
    <section className="s-sec"><div className="s-wrap s-narrow s-settings">
      <div className="s-set"><h2>Appearance</h2><p className="s-muted">The default is gold in light mode and purple in dark mode.</p>
        <div className="s-themes" role="radiogroup" aria-label="Theme">{THEMES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={'s-theme' + (theme === t.id ? ' on' : '')} onClick={() => { applyTheme(t.id); setTheme(t.id); flash('Theme saved'); }}>
          <span className="sw" style={{ background: t.id === 'system' ? 'linear-gradient(90deg,#fffdf6 50%,#13101f 50%)' : t.vars['--bg'], borderColor: t.vars['--brand'] ?? 'var(--line)' }}><i style={{ background: t.vars['--brand'] ?? 'var(--brand)' }} /></span>{t.label}</button>)}</div></div>
      <div className="s-set"><h2>Accessibility</h2>
        <label className="s-row"><input type="checkbox" checked={cur.highContrast} onChange={(e) => { a11y.set({ highContrast: e.target.checked }); flash('Saved'); }} /> High contrast</label>
        <label className="s-row"><input type="checkbox" checked={cur.reduceMotion} onChange={(e) => { a11y.set({ reduceMotion: e.target.checked }); flash('Saved'); }} /> Reduce motion</label>
        <label className="s-row"><input type="checkbox" checked={cur.strongFocus} onChange={(e) => { a11y.set({ strongFocus: e.target.checked }); flash('Saved'); }} /> Stronger focus outline</label>
        <label className="s-row"><input type="checkbox" checked={cur.announce} onChange={(e) => { a11y.set({ announce: e.target.checked }); flash('Saved'); }} /> Read out the active cell (screen readers)</label>
        <label className="s-row">Text size <select value={cur.textScale} onChange={(e) => { a11y.set({ textScale: +e.target.value as 100 }); flash('Saved'); }}>{[100, 115, 130, 150].map((n) => <option key={n} value={n}>{n}%</option>)}</select></label></div>
      <div className="s-set"><h2>Region</h2><p className="s-muted">Sets number, currency and date formats used in the editor.</p>
        <label className="s-row">Region <select value={region} onChange={(e) => { const v = e.target.value; setReg(v); void import('../i18n/i18nGlue').then((m) => m.setRegion(v)); flash('Region saved'); }}>{regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label></div>
      <div className="s-set"><h2>Server</h2><p className="s-muted">Optional Python service for large files and statistics. The editor works fully without it.</p><p className="s-row"><b>Status:</b> {server}</p></div>
      <p className="s-saved" role="status">{saved}</p>
    </div></section></>);
}

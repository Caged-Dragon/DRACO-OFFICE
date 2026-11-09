import { useMemo, useState } from 'react';
import type { Engine } from '../core/engine';
import { TEMPLATES } from './templates';
import { THEMES, PALETTES, textOn } from './themes';
import { suggest, explain, summarize, describeSummary } from './assist';
import * as G from './galleryGlue';
import { byPhase, totals, PARTIAL_NOTES, type Ver } from './parity';
import versions from '../versions.json';
import { SHORTCUTS, shortcutGroups } from '../cmd/commands';

export function TemplatesTab({ engine, openTemplate }: { engine: Engine; openTemplate: (id: string) => void }) {
  const [cat, setCat] = useState('All');
  const [theme, setTheme] = useState(G.getTheme());
  const [q, setQ] = useState('');
  const [out, setOut] = useState<ReturnType<typeof suggest>>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const cats = ['All', ...new Set(TEMPLATES.map((t) => t.category))];
  const list = TEMPLATES.filter((t) => cat === 'All' || t.category === cat);
  const paint = (hex: string) => {
    const rg = engine.api.getActiveWorkbook()?.getActiveRange();
    if (!rg) return;
    rg.setBackground(hex);
    rg.setFontColor(textOn(hex));
  };
  return (
    <div>
      <h3>Templates</h3>
      <div className="chart-list" role="group" aria-label="Template category">
        {cats.map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <ul className="thread-list">
        {list.map((t) => (
          <li key={t.id} className="thread" data-template={t.id}>
            <div className="thread-head">
              <b>{t.title}</b>
              <span>{t.category}</span>
            </div>
            <p className="hint">{t.blurb}</p>
            <button className="primary" onClick={() => openTemplate(t.id)}>
              Use this template
            </button>
          </li>
        ))}
      </ul>
      <h3>Themes</h3>
      <div className="chart-list" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={theme === t.id ? 'on' : ''}
            aria-pressed={theme === t.id}
            onClick={() => {
              G.applyTheme(t.id);
              setTheme(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <h3>
        Colour palettes <span className="hint">paint the selected cells</span>
      </h3>
      {PALETTES.map((p) => (
        <div key={p.id} className="row" role="group" aria-label={p.label}>
          <span className="hint" style={{ minWidth: 120 }}>
            {p.label}
          </span>
          {p.colors.map((c) => (
            <button
              key={c}
              aria-label={`${p.label} ${c}`}
              title={c}
              onClick={() => paint(c)}
              style={{
                background: c,
                minWidth: 28,
                width: 28,
                minHeight: 28,
                height: 28,
                padding: 0,
                border: '1px solid var(--line)',
              }}
            />
          ))}
        </div>
      ))}
      <h3>
        Assistant <span className="hint">works offline; rules, not a language model</span>
      </h3>
      <div className="row">
        <input
          aria-label="Describe what you want"
          style={{ flex: 1 }}
          placeholder="e.g. sum of column B, average of Price, count blanks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setOut(suggest(q, G.assistCtx(engine)));
          }}
        />
        <button onClick={() => setOut(suggest(q, G.assistCtx(engine)))}>Suggest</button>
      </div>
      <ul className="thread-list" aria-label="Suggestions">
        {out.map((s) => (
          <li key={s.formula} className="thread" data-suggest>
            <code>{s.formula}</code>
            <p className="hint">{s.why}</p>
            <button
              onClick={() => {
                setMsg(G.insertFormula(engine, s.formula) ? `Inserted ${s.formula}` : 'Select a cell first');
              }}
            >
              Insert in selected cell
            </button>
          </li>
        ))}
      </ul>
      {q && !out.length && <p className="hint">No suggestion yet — press Suggest.</p>}
      <div className="row">
        <button
          onClick={() => {
            const f = G.activeFormula(engine);
            setLines(f ? explain(f) : ['The selected cell has no formula.']);
          }}
        >
          Explain formula in selected cell
        </button>
        <button onClick={() => setLines(describeSummary(summarize(G.selectionValues(engine))))}>
          Summarise selection
        </button>
      </div>
      <ul aria-label="Explanation" role="status">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {msg && (
        <p className="hint okmsg" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

export function KeysTab() {
  const [q, setQ] = useState('');
  const rows = SHORTCUTS.filter(
    (r) => !q || (r.keys + ' ' + r.what + ' ' + r.group).toLowerCase().includes(q.toLowerCase()),
  );
  const groups = shortcutGroups(rows);
  return (
    <div>
      <p className="hint">
        Press <kbd>Ctrl</kbd>+<kbd>/</kbd> or <kbd>Alt</kbd>+<kbd>Q</kbd> to search every command. Mac: Ctrl = ⌘.
      </p>
      <input
        aria-label="Filter shortcuts"
        placeholder="Filter shortcuts"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {groups.map((g) => (
        <div key={g.group}>
          <h3>{g.group}</h3>
          <table className="chg">
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.keys + r.what}>
                  <td>
                    <kbd>{r.keys}</kbd>
                  </td>
                  <td>{r.what}</td>
                  <td className="hint">
                    {r.support === 'native' ? 'built in' : r.support === 'draco' ? 'Draco' : 'palette'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function ParityTab({ engine, onRoadmap }: { engine: Engine; onRoadmap: () => void }) {
  const list = versions as Ver[];
  const t = totals(list);
  const rows = byPhase(list);
  const [res, setRes] = useState<Awaited<ReturnType<typeof G.runSelfTest>> | null>(null);
  const [busy, setBusy] = useState(false);
  const partial = list.filter((x) => x.status === 'partial');
  const fails = res?.filter((r) => !r.pass) ?? [];
  const run = async () => {
    setBusy(true);
    try {
      setRes(await G.runSelfTest(engine));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p role="status">
        <b>{t.done}</b> done · <b>{t.partial}</b> partial · <b>{t.planned}</b> planned — about <b>{t.pct}%</b> overall
        parity with this roadmap.
      </p>
      <table className="chg" aria-label="Progress by phase">
        <tbody>
          {rows.map((r) => (
            <tr key={r.phase}>
              <td>{r.phase}</td>
              <td>
                {r.done}/{r.total}
              </td>
              <td>{r.partial ? `${r.partial} partial` : ''}</td>
              <td>{r.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onRoadmap}>Open the full roadmap</button>
      <h3>Known gaps</h3>
      <ul>
        {partial.map((x) => (
          <li key={x.v}>
            <b>v{x.v}</b> {x.title}
            {PARTIAL_NOTES[x.v] ? ` — ${PARTIAL_NOTES[x.v]}` : ''}
          </li>
        ))}
      </ul>
      <h3>Formula self-test</h3>
      <p className="hint">
        Calculates {res?.length ?? 'about 50'} formulas in a temporary sheet and compares them with the expected
        answers.
      </p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => void run()}>
          {busy ? 'Running…' : 'Run self-test'}
        </button>
        {res && (
          <span role="status" data-selftest>
            {res.length - fails.length}/{res.length} passed
          </span>
        )}
      </div>
      {fails.length > 0 && (
        <ul className="msg">
          {fails.map((f) => (
            <li key={f.name}>
              {f.name}: {f.formula} gave {String(f.got)}, expected {String(f.expect)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
void useMemo;

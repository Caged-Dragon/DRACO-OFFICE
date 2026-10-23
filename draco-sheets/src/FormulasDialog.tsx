import { useEffect, useMemo, useState } from 'react';
import Dialog from './Dialog';
import type { Engine } from './engine';
import { a1, dependents, precedents, rectLabel } from './audit';
import {
  activeCell, calculateNow, cellInfo, circularCells, collectErrors, collectFormulas, jumpTo, listNames, nameMap, removeName,
  saveName, selectionRef, stopCalculation, validateName, type ErrorCell, type NameRow,
} from './formulaTools';

type Tab = 'names' | 'audit' | 'errors' | 'watch' | 'calc';
interface Watch { sheet: string; row: number; col: number }
const WATCH_KEY = 'draco:watch';
const loadWatch = (): Watch[] => { try { return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]'); } catch { return []; } };

export default function FormulasDialog({ engine, initial = 'names', onClose }: { engine: Engine; initial?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initial);
  const jump = (s: string, r: number, c: number) => { jumpTo(engine, s, r, c); onClose(); };
  return (
    <Dialog title="Formulas" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {([['names', 'Name Manager'], ['audit', 'Auditing'], ['errors', 'Error checking'], ['watch', 'Watch window'], ['calc', 'Calculation']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'names' && <Names engine={engine} />}
      {tab === 'audit' && <Audit engine={engine} jump={jump} />}
      {tab === 'errors' && <Errors engine={engine} jump={jump} />}
      {tab === 'watch' && <WatchWindow engine={engine} jump={jump} />}
      {tab === 'calc' && <Calc engine={engine} />}
    </Dialog>
  );
}

function Names({ engine }: { engine: Engine }) {
  const [rows, setRows] = useState<NameRow[]>(() => listNames(engine));
  const [name, setName] = useState(''); const [ref, setRef] = useState(() => selectionRef(engine)); const [comment, setComment] = useState('');
  const [editing, setEditing] = useState<string | undefined>(); const [err, setErr] = useState('');
  const refresh = () => setRows(listNames(engine));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bad = validateName(name, rows.map((r) => r.name), editing) ?? (!ref.trim() ? 'Enter what the name refers to.' : null);
    if (bad) return setErr(bad);
    try { saveName(engine, name, ref, comment, editing); } catch (x) { return setErr(String((x as Error).message ?? x)); }
    setName(''); setComment(''); setEditing(undefined); setErr(''); refresh();
  };
  return (
    <>
      <form onSubmit={submit} className="stack" aria-label="Define name">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SalesData" /></label>
        <label>Refers to<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Sheet1!$B$1:$B$5 or =A1*2" /></label>
        <label>Comment (optional)<input value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        <div className="row-btns">
          <button className="primary">{editing ? 'Update name' : 'Add name'}</button>
          <button type="button" onClick={() => setRef(selectionRef(engine))}>Use current selection</button>
          {editing && <button type="button" onClick={() => { setEditing(undefined); setName(''); setComment(''); setErr(''); }}>Cancel edit</button>}
        </div>
        {err && <p className="msg" role="alert">{err}</p>}
      </form>
      <h3>Defined names ({rows.length})</h3>
      {rows.length === 0 ? <p className="hint">No names yet. Select cells, name them above, then use the name in formulas: <code>=SUM(SalesData)</code></p> : (
        <ul className="filelist">
          {rows.map((r) => (
            <li key={r.name}>
              <button className="row" onClick={() => { setEditing(r.name); setName(r.name); setRef(r.ref); setComment(r.comment); setErr(''); }}>
                <span className="name">{r.name}</span><span className="meta">{r.ref}{r.comment ? ` · ${r.comment}` : ''}</span>
              </button>
              <button className="icon" aria-label={`Delete name ${r.name}`} onClick={() => { removeName(engine, r.name); refresh(); }}>🗑</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Audit({ engine, jump }: { engine: Engine; jump: (s: string, r: number, c: number) => void }) {
  const cell = useMemo(() => activeCell(engine), [engine]);
  const [deep, setDeep] = useState(false);
  const all = useMemo(() => collectFormulas(engine), [engine]);
  const names = useMemo(() => nameMap(engine), [engine]);
  const [mode, setMode] = useState<'pre' | 'dep' | 'list'>('pre');
  if (!cell) return <p>Select a cell first.</p>;
  const label = `${cell.sheet}!${a1(cell.row, cell.col)}`;
  const pre = mode === 'pre' ? precedents(cell, all, names, deep) : [];
  const dep = mode === 'dep' ? dependents(cell, all, names, deep) : [];
  return (
    <>
      <p className="hint">Active cell: <b>{label}</b> {all.find((f) => f.sheet === cell.sheet && f.row === cell.row && f.col === cell.col)?.formula ?? '(no formula)'}</p>
      <div className="row-btns">
        <button className={mode === 'pre' ? 'primary' : ''} onClick={() => setMode('pre')}>Trace precedents</button>
        <button className={mode === 'dep' ? 'primary' : ''} onClick={() => setMode('dep')}>Trace dependents</button>
        <button className={mode === 'list' ? 'primary' : ''} onClick={() => setMode('list')}>All formulas</button>
        {mode !== 'list' && <label className="inline"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> All levels</label>}
      </div>
      <ul className="filelist">
        {mode === 'pre' && (pre.length === 0 ? <li className="hint">This cell has no precedents.</li> : pre.map((r, i) => (
          <li key={i}><button className="row" onClick={() => jump(r.sheet ?? cell.sheet, r.r1, r.c1)}><span className="name">{rectLabel(r, cell.sheet)}</span><span className="meta">{r.sheet}</span></button></li>
        )))}
        {mode === 'dep' && (dep.length === 0 ? <li className="hint">No cells depend on this cell.</li> : dep.map((f, i) => (
          <li key={i}><button className="row" onClick={() => jump(f.sheet, f.row, f.col)}><span className="name">{f.sheet}!{a1(f.row, f.col)}</span><span className="meta">{f.formula}</span></button></li>
        )))}
        {mode === 'list' && (all.length === 0 ? <li className="hint">No formulas in this workbook.</li> : all.slice(0, 500).map((f, i) => (
          <li key={i}><button className="row" onClick={() => jump(f.sheet, f.row, f.col)}><span className="name">{f.sheet}!{a1(f.row, f.col)}</span><span className="meta">{f.formula}</span></button></li>
        )))}
      </ul>
    </>
  );
}

function Errors({ engine, jump }: { engine: Engine; jump: (s: string, r: number, c: number) => void }) {
  const [errs, setErrs] = useState<ErrorCell[] | null>(null);
  const [circ, setCirc] = useState<{ cells: { sheet: string; row: number; col: number; formula: string }[]; skipped: boolean }>({ cells: [], skipped: false });
  const scan = () => { setErrs(collectErrors(engine)); setCirc(circularCells(engine)); };
  useEffect(scan, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="row-btns"><button className="primary" onClick={scan}>Scan workbook</button></div>
      {circ.cells.length > 0 && (<>
        <h3 role="alert">⚠ Circular references ({circ.cells.length}) — these cells evaluate to 0</h3>
        <ul className="filelist">{circ.cells.map((x, i) => (
          <li key={i}><button className="row" onClick={() => jump(x.sheet, x.row, x.col)}><span className="name">{x.sheet}!{a1(x.row, x.col)}</span><span className="meta">{x.formula}</span></button></li>
        ))}</ul></>)}
      {circ.skipped && <p className="hint">Circular-reference check skipped (more than 5,000 formulas).</p>}
      {errs === null ? <p>Scanning…</p> : errs.length === 0 ? <p className="hint">✔ No error values found in any sheet.{circ.cells.length === 0 && !circ.skipped ? ' No circular references.' : ''}</p> : (
        <ul className="filelist">{errs.map((x, i) => (
          <li key={i}><button className="row" onClick={() => jump(x.sheet, x.row, x.col)}><span className="name">{x.sheet}!{a1(x.row, x.col)} — {x.value}</span><span className="meta">{x.formula || 'typed value'}</span></button></li>
        ))}</ul>
      )}
    </>
  );
}

function WatchWindow({ engine, jump }: { engine: Engine; jump: (s: string, r: number, c: number) => void }) {
  const [list, setList] = useState<Watch[]>(loadWatch); const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);
  const save = (l: Watch[]) => { setList(l); try { localStorage.setItem(WATCH_KEY, JSON.stringify(l)); } catch { /* storage unavailable */ } };
  const add = () => { const c = activeCell(engine); if (c && !list.some((w) => w.sheet === c.sheet && w.row === c.row && w.col === c.col)) save([...list, c]); };
  return (
    <>
      <div className="row-btns"><button className="primary" onClick={add}>Add watch for current cell</button></div>
      {list.length === 0 ? <p className="hint">Watch cells here and see their values update live while you work on other sheets.</p> : (
        <table className="watch"><thead><tr><th>Sheet</th><th>Cell</th><th>Value</th><th>Formula</th><th /></tr></thead><tbody>
          {list.map((w, i) => { const info = cellInfo(engine, w.sheet, w.row, w.col); return (
            <tr key={i}><td>{w.sheet}</td><td><button className="link" onClick={() => jump(w.sheet, w.row, w.col)}>{a1(w.row, w.col)}</button></td><td>{info.value}</td><td className="mono">{info.formula}</td>
              <td><button className="icon" aria-label={`Remove watch ${a1(w.row, w.col)}`} onClick={() => save(list.filter((_, j) => j !== i))}>✕</button></td></tr>); })}
        </tbody></table>
      )}
    </>
  );
}

function Calc({ engine }: { engine: Engine }) {
  const [msg, setMsg] = useState('');
  return (
    <>
      <div className="row-btns">
        <button className="primary" onClick={() => { calculateNow(engine); setMsg('Recalculation started.'); }}>Calculate now</button>
        <button onClick={() => { stopCalculation(engine); setMsg('Calculation stopped.'); }}>Stop calculation</button>
      </div>
      {msg && <p className="hint" role="status">{msg}</p>}
      <p className="hint">Formulas recalculate automatically in a background worker. A manual-calculation mode and iterative calculation for circular references are not available in the current engine.</p>
    </>
  );
}

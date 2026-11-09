import { useRef, useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { jumpTo } from '../formulas/formulaTools';

interface Hit {
  sheet: string;
  a1: string;
  row: number;
  col: number;
  text: string;
}
type Finder = {
  findAll(): {
    getA1Notation(): string;
    getRow(): number;
    getColumn(): number;
    getDisplayValue(): string;
    getSheetName?: () => string;
  }[];
  findNext(): { activate(): unknown } | null;
  findPrevious(): { activate(): unknown } | null;
  matchCaseAsync(v: boolean): Promise<unknown>;
  matchEntireCellAsync(v: boolean): Promise<unknown>;
  matchFormulaTextAsync(v: boolean): Promise<unknown>;
  replaceAllWithAsync(t: string): Promise<number>;
  replaceWithAsync(t: string): Promise<boolean>;
  ensureCompleteAsync(): Promise<unknown>;
};

/** Find & Replace (Ctrl+F / Ctrl+H): find next/previous, list all matches, replace one or all. */
export default function FindDialog({
  engine,
  replace: startReplace,
  onClose,
}: {
  engine: Engine;
  replace?: boolean;
  onClose: () => void;
}) {
  const [what, setWhat] = useState('');
  const [rep, setRep] = useState('');
  const [showRep, setShowRep] = useState(Boolean(startReplace));
  const [mc, setMc] = useState(false);
  const [whole, setWhole] = useState(false);
  const [formulas, setFormulas] = useState(false);
  const [msg, setMsg] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const busy = useRef(false);
  const finder = async (): Promise<Finder | null> => {
    if (!what) {
      setMsg('Type something to find.');
      return null;
    }
    const f = await (
      engine.api as unknown as { createTextFinderAsync(t: string): Promise<Finder | null> }
    ).createTextFinderAsync(what);
    if (!f) {
      setMsg('Nothing to search.');
      return null;
    }
    // The finder indexes in the background; option setters can stall, so guard them and wait for the match count to settle.
    const soon = (p: Promise<unknown>) => Promise.race([p, new Promise((r) => setTimeout(r, 700))]);
    if (mc) await soon(f.matchCaseAsync(true));
    if (whole) await soon(f.matchEntireCellAsync(true));
    if (formulas) await soon(f.matchFormulaTextAsync(true));
    let last = -1;
    let stable = 0;
    for (let i = 0; i < 20 && stable < 3; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const n = f.findAll().length;
      stable = n === last ? stable + 1 : 0;
      last = n;
    }
    return f;
  };
  const run = (fn: () => Promise<void>) => async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } finally {
      busy.current = false;
    }
  };
  const step = (dir: 'next' | 'prev') =>
    run(async () => {
      const f = await finder();
      if (!f) return;
      const r = dir === 'next' ? f.findNext() : f.findPrevious();
      if (r) {
        r.activate();
        setMsg('');
      } else setMsg('No matches found.');
    });
  const all = run(async () => {
    const f = await finder();
    if (!f) return;
    const sh = engine.api.getActiveWorkbook()?.getActiveSheet().getSheetName() ?? '';
    const list = f.findAll().map((r) => ({
      sheet: sh,
      a1: r.getA1Notation(),
      row: r.getRow(),
      col: r.getColumn(),
      text: String(r.getDisplayValue()),
    }));
    setHits(list);
    setMsg(list.length ? `${list.length} match${list.length === 1 ? '' : 'es'} found.` : 'No matches found.');
  });
  const one = run(async () => {
    const f = await finder();
    if (!f) return;
    f.findNext();
    const ok = await f.replaceWithAsync(rep);
    setMsg(ok ? 'Replaced one match.' : 'No matches found.');
  });
  const every = run(async () => {
    const f = await finder();
    if (!f) return;
    const n = await f.replaceAllWithAsync(rep);
    setMsg(n ? `Replaced ${n} match${n === 1 ? '' : 'es'}.` : 'No matches found.');
    setHits([]);
  });
  return (
    <Dialog title={showRep ? 'Find and replace' : 'Find'} onClose={onClose}>
      <div className="find-form">
        <label>
          Find what
          <input
            aria-label="Find what"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void (e.shiftKey ? step('prev') : step('next'))();
            }}
          />
        </label>
        {showRep && (
          <label>
            Replace with
            <input aria-label="Replace with" value={rep} onChange={(e) => setRep(e.target.value)} />
          </label>
        )}
        <div className="row-btns">
          <label className="inline">
            <input type="checkbox" checked={mc} onChange={(e) => setMc(e.target.checked)} /> Match case
          </label>
          <label className="inline">
            <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> Entire cell
          </label>
          <label className="inline">
            <input type="checkbox" checked={formulas} onChange={(e) => setFormulas(e.target.checked)} /> Look in
            formulas
          </label>
        </div>
        <div className="row-btns">
          <button className="primary" onClick={() => void step('next')()}>
            Find next
          </button>
          <button onClick={() => void step('prev')()}>Find previous</button>
          <button onClick={() => void all()}>Find all</button>
          {showRep ? (
            <>
              <button onClick={() => void one()}>Replace</button>
              <button onClick={() => void every()}>Replace all</button>
            </>
          ) : (
            <button onClick={() => setShowRep(true)}>Replace…</button>
          )}
        </div>
        {msg && (
          <p className="hint" role="status">
            {msg}
          </p>
        )}
        {hits.length > 0 && (
          <table className="watch">
            <thead>
              <tr>
                <th>Sheet</th>
                <th>Cell</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {hits.slice(0, 300).map((h) => (
                <tr key={h.sheet + h.a1} className="clickable" onClick={() => jumpTo(engine, h.sheet, h.row, h.col)}>
                  <td>{h.sheet}</td>
                  <td>{h.a1}</td>
                  <td>{h.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  );
}

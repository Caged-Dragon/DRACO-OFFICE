import { useMemo, useState, type ReactNode } from 'react';
import Dialog from './Dialog';
import type { Engine } from './engine';
import { TABLE_STYLES, type ConsFn, type SpecialKind } from './dataTools';
import {
  advancedFilterReset, advancedFilterRun, clearTableRun, colName, consolidateRun, dataTableRun, dedupeRunAsync, flashFillRun, formatAsTableRun,
  goalSeekRun, goTo, goToSpecialRun, loadScenarios, removeSubtotalsRun, scenarioDelete, scenarioSave, scenarioShow, selectionLoc,
  subtotalRun, targetLoc, textToColumnsRun, readDisplay, type Out,
} from './dataGlue';

export type DataTab = 'goto' | 'dupes' | 'text' | 'flash' | 'adv' | 'subtotal' | 'table' | 'whatif' | 'consol';
const TABS: [DataTab, string][] = [['goto', 'Go To'], ['dupes', 'Remove duplicates'], ['text', 'Text to columns'], ['flash', 'Flash Fill'], ['adv', 'Advanced filter'], ['subtotal', 'Subtotal'], ['table', 'Format as table'], ['whatif', 'What-if'], ['consol', 'Consolidate']];

function Result({ r }: { r: Out | null }) {
  if (!r) return null;
  return <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p>;
}
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="inline"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>
);

export default function DataDialog({ engine, initial = 'goto', onClose }: { engine: Engine; initial?: DataTab; onClose: () => void }) {
  const [tab, setTab] = useState<DataTab>(initial);
  return (
    <Dialog title="Data tools" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'goto' && <GoTo engine={engine} onClose={onClose} />}
      {tab === 'dupes' && <Dupes engine={engine} />}
      {tab === 'text' && <TextCols engine={engine} />}
      {tab === 'flash' && <Flash engine={engine} />}
      {tab === 'adv' && <Adv engine={engine} />}
      {tab === 'subtotal' && <Subtotal engine={engine} />}
      {tab === 'table' && <TableTab engine={engine} />}
      {tab === 'whatif' && <WhatIf engine={engine} />}
      {tab === 'consol' && <Consol engine={engine} />}
    </Dialog>
  );
}

function GoTo({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [ref, setRef] = useState(''); const [kind, setKind] = useState<SpecialKind>('blanks'); const [scope, setScope] = useState<'selection' | 'sheet'>('selection');
  const [r, setR] = useState<Out | null>(null);
  const KINDS: [SpecialKind, string][] = [['blanks', 'Blanks'], ['constants', 'Constants'], ['numbers', 'Constants: numbers'], ['text', 'Constants: text'], ['logical', 'Constants: logical'], ['formulas', 'Formulas'], ['formulaNumbers', 'Formulas: numbers'], ['formulaText', 'Formulas: text'], ['formulaErrors', 'Formulas: errors'], ['errors', 'Errors'], ['lastCell', 'Last cell']];
  return (
    <>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); const o = goTo(engine, ref); if (o.ok) onClose(); else setR(o); }}>
        <Field label="Go to (cell, range or name)"><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. D20, Sheet2!A1:C5, SalesData" /></Field>
        <div className="row-btns"><button className="primary">Go</button></div>
      </form>
      <h3>Go To Special</h3>
      <div className="stack">
        <Field label="Select"><select value={kind} onChange={(e) => setKind(e.target.value as SpecialKind)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Look in"><select value={scope} onChange={(e) => setScope(e.target.value as 'selection' | 'sheet')}><option value="selection">Current selection</option><option value="sheet">Whole sheet (used range)</option></select></Field>
        <div className="row-btns"><button className="primary" onClick={() => setR(goToSpecialRun(engine, kind, scope))}>Select cells</button></div>
      </div>
      <Result r={r} />
    </>
  );
}

function Dupes({ engine }: { engine: Engine }) {
  const [hdr, setHdr] = useState(true); const [cs, setCs] = useState(false); const [r, setR] = useState<Out | null>(null);
  const loc = useMemo(() => targetLoc(engine), [engine]);
  const heads = useMemo(() => (loc ? (readDisplay({ ...loc, rng: loc.sheet.getRange(loc.r0, loc.c0, 1, loc.cols) }) as unknown[][])[0].map((h, i) => (hdr && h ? String(h) : `Column ${colName(loc.c0 + i)}`)) : []), [loc, hdr]);
  const [cols, setCols] = useState<boolean[] | null>(null);
  const sel = cols ?? heads.map(() => true);
  if (!loc) return <p>Select a range first.</p>;
  return (
    <>
      <p className="hint">Range: <b>{loc.sheet.getSheetName()}!{colName(loc.c0)}{loc.r0 + 1}:{colName(loc.c0 + loc.cols - 1)}{loc.r0 + loc.rows}</b></p>
      <Check label="My data has headers" checked={hdr} onChange={setHdr} />
      <Check label="Match case" checked={cs} onChange={setCs} />
      <p className="hint">Columns to compare:</p>
      <div className="checks">{heads.map((h, i) => <Check key={i} label={h} checked={sel[i]} onChange={(v) => setCols(sel.map((x, j) => (j === i ? v : x)))} />)}</div>
      <div className="row-btns"><button className="primary" onClick={async () => { setR({ ok: true, message: 'Working in the background…' }); setR(await dedupeRunAsync(engine, sel.map((v, i) => (v ? i : -1)).filter((i) => i >= 0), hdr, cs)); }}>Remove duplicates</button></div>
      <Result r={r} />
    </>
  );
}

function TextCols({ engine }: { engine: Engine }) {
  const [d, setD] = useState(','); const [custom, setCustom] = useState(''); const [merge, setMerge] = useState(false); const [q, setQ] = useState('"'); const [ow, setOw] = useState(false); const [r, setR] = useState<Out | null>(null);
  const delim = d === 'custom' ? custom : d === 'tab' ? '\t' : d;
  return (
    <>
      <p className="hint">Select one column of cells, then split each into columns to the right.</p>
      <div className="stack">
        <Field label="Delimiter"><select value={d} onChange={(e) => setD(e.target.value)}><option value=",">Comma</option><option value=";">Semicolon</option><option value="tab">Tab</option><option value=" ">Space</option><option value="|">Pipe</option><option value="custom">Other…</option></select></Field>
        {d === 'custom' && <Field label="Other delimiter"><input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={5} /></Field>}
        <Field label="Text qualifier"><select value={q} onChange={(e) => setQ(e.target.value)}><option value={'"'}>Double quote (")</option><option value="'">Single quote (')</option><option value="">None</option></select></Field>
        <Check label="Treat consecutive delimiters as one" checked={merge} onChange={setMerge} />
        <Check label="Overwrite existing data on the right" checked={ow} onChange={setOw} />
        <div className="row-btns"><button className="primary" onClick={() => setR(textToColumnsRun(engine, delim, merge, q, ow))}>Split</button></div>
      </div>
      <Result r={r} />
    </>
  );
}

function Flash({ engine }: { engine: Engine }) {
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">Type one or two examples in the column next to your data (for example “Smith, John” beside “John Smith”), click a cell in that column, then run Flash Fill. It learns the pattern from your examples and fills the rest.</p>
      <div className="row-btns"><button className="primary" onClick={() => setR(flashFillRun(engine))}>Flash Fill</button></div>
      <Result r={r} />
    </>
  );
}

function Adv({ engine }: { engine: Engine }) {
  const sel = selectionLoc(engine);
  const [list, setList] = useState(sel && sel.rows * sel.cols > 1 ? `${colName(sel.c0)}${sel.r0 + 1}:${colName(sel.c0 + sel.cols - 1)}${sel.r0 + sel.rows}` : '');
  const [crit, setCrit] = useState(''); const [act, setAct] = useState<'inplace' | 'copy'>('inplace'); const [dest, setDest] = useState(''); const [uniq, setUniq] = useState(false); const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">Criteria range: header row (matching your column names) plus criteria rows. Cells in a row are AND, rows are OR. Operators: <code>&gt;40</code>, <code>&lt;=30</code>, <code>&lt;&gt;x</code>, <code>=text</code>, wildcards <code>*</code> <code>?</code>.</p>
      <div className="stack">
        <Field label="List range (with headers)"><input value={list} onChange={(e) => setList(e.target.value)} placeholder="A1:D50" /></Field>
        <Field label="Criteria range (with headers)"><input value={crit} onChange={(e) => setCrit(e.target.value)} placeholder="F1:G3" /></Field>
        <Field label="Action"><select value={act} onChange={(e) => setAct(e.target.value as 'inplace' | 'copy')}><option value="inplace">Filter the list, in place</option><option value="copy">Copy to another location</option></select></Field>
        {act === 'copy' && <Field label="Copy to"><input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="I1" /></Field>}
        <Check label="Unique records only" checked={uniq} onChange={setUniq} />
        <div className="row-btns">
          <button className="primary" onClick={() => setR(advancedFilterRun(engine, list, crit, act, dest, uniq))}>Apply filter</button>
          <button onClick={() => setR(advancedFilterReset(engine, list))}>Show all rows</button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

function Subtotal({ engine }: { engine: Engine }) {
  const loc = useMemo(() => targetLoc(engine), [engine]);
  const heads = useMemo(() => (loc ? (readDisplay({ ...loc, rng: loc.sheet.getRange(loc.r0, loc.c0, 1, loc.cols) }) as unknown[][])[0].map((h, i) => (h ? String(h) : `Column ${colName(loc.c0 + i)}`)) : []), [loc]);
  const [g, setG] = useState(0); const [fn, setFn] = useState<9 | 1 | 2 | 4 | 5 | 6>(9); const [sum, setSum] = useState<Record<number, boolean>>({}); const [r, setR] = useState<Out | null>(null);
  if (!loc) return <p>Select the data range (with a header row) first.</p>;
  return (
    <>
      <p className="hint">Sort the data by the group column first. A subtotal row is inserted after each change in that column, plus a grand total.</p>
      <div className="stack">
        <Field label="At each change in"><select value={g} onChange={(e) => setG(Number(e.target.value))}>{heads.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></Field>
        <Field label="Use function"><select value={fn} onChange={(e) => setFn(Number(e.target.value) as 9)}><option value={9}>Sum</option><option value={1}>Average</option><option value={2}>Count</option><option value={4}>Max</option><option value={5}>Min</option><option value={6}>Product</option></select></Field>
        <p className="hint">Add subtotal to:</p>
        <div className="checks">{heads.map((h, i) => i !== g && <Check key={i} label={h} checked={!!sum[i]} onChange={(v) => setSum({ ...sum, [i]: v })} />)}</div>
        <div className="row-btns">
          <button className="primary" onClick={() => setR(subtotalRun(engine, g, Object.entries(sum).filter(([, v]) => v).map(([k]) => Number(k)), fn))}>Add subtotals</button>
          <button onClick={() => setR(removeSubtotalsRun(engine))}>Remove all</button>
        </div>
      </div>
      <Result r={r} />
    </>
  );
}

function TableTab({ engine }: { engine: Engine }) {
  const [s, setS] = useState(0); const [band, setBand] = useState(true); const [tot, setTot] = useState(false); const [fil, setFil] = useState(true); const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">Formats the selected range (or the region around the active cell) as a styled table with a header row.</p>
      <div className="swatches">{TABLE_STYLES.map((t, i) => (
        <button key={t.name} className="swatch" aria-pressed={s === i} style={{ background: t.header.bg, color: t.header.fg, outline: s === i ? '3px solid var(--accent)' : undefined, fontWeight: 700 }} onClick={() => setS(i)}>{t.name}</button>
      ))}</div>
      <Check label="Banded rows" checked={band} onChange={setBand} /> <Check label="Total row (bold last row)" checked={tot} onChange={setTot} /> <Check label="Filter buttons" checked={fil} onChange={setFil} />
      <div className="row-btns"><button className="primary" onClick={() => setR(formatAsTableRun(engine, s, { banded: band, totalRow: tot, filter: fil }))}>Format as table</button><button onClick={() => setR(clearTableRun(engine))}>Clear table style</button></div>
      <Result r={r} />
    </>
  );
}

function WhatIf({ engine }: { engine: Engine }) {
  const [setC, setSetC] = useState(''); const [to, setTo] = useState(''); const [by, setBy] = useState(''); const [busy, setBusy] = useState(false); const [r, setR] = useState<Out | null>(null);
  const [dIn, setDIn] = useState(''); const [dF, setDF] = useState('');
  const [sn, setSn] = useState(''); const [sc, setSc] = useState(''); const [scs, setScs] = useState(() => loadScenarios(engine));
  const run = async (f: () => Promise<Out>) => { setBusy(true); try { setR(await f()); } finally { setBusy(false); } };
  return (
    <>
      <h3>Goal Seek</h3>
      <div className="stack">
        <Field label="Set cell (contains a formula)"><input value={setC} onChange={(e) => setSetC(e.target.value)} placeholder="B5" /></Field>
        <Field label="To value"><input value={to} onChange={(e) => setTo(e.target.value)} inputMode="decimal" placeholder="200" /></Field>
        <Field label="By changing cell (contains a value)"><input value={by} onChange={(e) => setBy(e.target.value)} placeholder="B2" /></Field>
        <div className="row-btns"><button className="primary" disabled={busy} onClick={() => run(() => goalSeekRun(engine, setC, Number(to), by))}>{busy ? 'Working…' : 'Solve'}</button></div>
      </div>
      <h3>Data table (one variable)</h3>
      <p className="hint">Select a column of input values, then name the input cell and the formula cell. Results fill the next column.</p>
      <div className="stack">
        <Field label="Column input cell"><input value={dIn} onChange={(e) => setDIn(e.target.value)} placeholder="B2" /></Field>
        <Field label="Formula cell"><input value={dF} onChange={(e) => setDF(e.target.value)} placeholder="B5" /></Field>
        <div className="row-btns"><button disabled={busy} onClick={() => run(() => dataTableRun(engine, dIn, dF))}>Fill data table</button></div>
      </div>
      <h3>Scenarios</h3>
      <div className="stack">
        <Field label="Scenario name"><input value={sn} onChange={(e) => setSn(e.target.value)} /></Field>
        <Field label="Changing cells (current values are saved)"><input value={sc} onChange={(e) => setSc(e.target.value)} placeholder="B1, B2, B3" /></Field>
        <div className="row-btns"><button onClick={() => { const o = scenarioSave(engine, sn, sc); setR(o); setScs(loadScenarios(engine)); }}>Save scenario</button></div>
      </div>
      {scs.length > 0 && <ul className="filelist">{scs.map((s) => (
        <li key={s.name}><button className="row" onClick={() => run(() => scenarioShow(engine, s.name))}><span className="name">{s.name}</span><span className="meta">{Object.entries(s.cells).map(([k, v]) => `${k.split('!')[1]}=${v}`).join(', ')}</span></button>
          <button className="icon" aria-label={`Delete scenario ${s.name}`} onClick={() => { setR(scenarioDelete(engine, s.name)); setScs(loadScenarios(engine)); }}>🗑</button></li>
      ))}</ul>}
      <Result r={r} />
    </>
  );
}

function Consol({ engine }: { engine: Engine }) {
  const [refs, setRefs] = useState(''); const [fn, setFn] = useState<ConsFn>('sum'); const [mode, setMode] = useState<'position' | 'labels'>('labels'); const [dest, setDest] = useState(''); const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">One source range per line, e.g. <code>Sheet1!A1:C5</code>. “By labels” matches the first row and first column text across sources.</p>
      <div className="stack">
        <Field label="Source ranges"><textarea rows={4} value={refs} onChange={(e) => setRefs(e.target.value)} placeholder={'Sheet1!A1:C5\nSheet2!A1:C5'} /></Field>
        <Field label="Function"><select value={fn} onChange={(e) => setFn(e.target.value as ConsFn)}>{(['sum', 'average', 'count', 'max', 'min', 'product'] as ConsFn[]).map((f) => <option key={f} value={f}>{f}</option>)}</select></Field>
        <Field label="Combine"><select value={mode} onChange={(e) => setMode(e.target.value as 'position' | 'labels')}><option value="labels">By labels (top row + left column)</option><option value="position">By position</option></select></Field>
        <Field label="Destination (top-left cell)"><input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="H1" /></Field>
        <div className="row-btns"><button className="primary" onClick={() => setR(consolidateRun(engine, refs.split('\n'), fn, mode, dest))}>Consolidate</button></div>
      </div>
      <Result r={r} />
    </>
  );
}

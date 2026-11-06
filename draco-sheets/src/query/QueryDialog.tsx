import { useMemo, useState, type ReactNode } from 'react';
import Dialog from '../Dialog';
import type { Engine } from '../engine';
import { describeStep, type FilterOp, type Step, type Table } from './query';
import { fetchText, getQueries, getQuery, loadToSheet, previewQuery, refreshAllQueries, removeQuery, saveQuery, type QueryDef, type QuerySource } from './queryGlue';
import { AGG_LABEL, type Agg } from '../pivot/pivot';
import { chartDefault } from '../charts/chartGlue';
import type { Out } from '../dataGlue';

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => <label className="inline"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
const Result = ({ r }: { r: Out | null }) => (r ? <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p> : null);
const move = <T,>(a: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; };
const OPS: Array<[FilterOp, string]> = [['=', 'equals'], ['!=', 'does not equal'], ['>', 'greater than'], ['>=', 'greater or equal'], ['<', 'less than'], ['<=', 'less or equal'], ['contains', 'contains'], ['notContains', 'does not contain'], ['startsWith', 'begins with'], ['endsWith', 'ends with'], ['isBlank', 'is blank'], ['notBlank', 'is not blank']];
const STEP_TYPES: Array<[Step['t'], string]> = [['filter', 'Filter rows'], ['removeCols', 'Remove columns'], ['keepCols', 'Keep columns'], ['rename', 'Rename column'], ['type', 'Change type'], ['sort', 'Sort'], ['split', 'Split column'], ['merge', 'Merge columns'], ['addCol', 'Add calculated column'], ['replace', 'Replace values'], ['text', 'Transform text'], ['dedupe', 'Remove duplicates'], ['removeBlankRows', 'Remove blank rows'], ['fillDown', 'Fill down'], ['keepRows', 'Keep top/bottom rows'], ['removeRows', 'Remove top/bottom rows'], ['group', 'Group by'], ['unpivot', 'Unpivot columns'], ['append', 'Append another table'], ['join', 'Merge (join) another table']];

export default function QueryDialog({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [list, setList] = useState<QueryDef[]>(() => [...getQueries()]); const [sel, setSel] = useState<string | null>(() => getQueries()[0]?.id ?? null); const [r, setR] = useState<Out | null>(null);
  const reload = () => setList([...getQueries()]);
  return (
    <Dialog title="Queries (import & transform)" onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Queries">
        {list.map((q) => <button key={q.id} role="tab" aria-selected={sel === q.id} className={sel === q.id ? 'on' : ''} onClick={() => { setSel(q.id); setR(null); }}>{q.name}</button>)}
        <button role="tab" aria-selected={sel === null} className={sel === null ? 'on' : ''} onClick={() => { setSel(null); setR(null); }}>＋ New query</button>
        {list.length > 0 && <button onClick={async () => { setR(await refreshAllQueries(engine)); }}>Refresh all</button>}
      </div>
      <Editor key={sel ?? 'new'} engine={engine} def={sel ? getQuery(sel) : null} onSaved={(id) => { reload(); setSel(id); }} onDeleted={() => { reload(); setSel(null); }} />
      <Result r={r} />
    </Dialog>
  );
}

function Editor({ engine, def, onSaved, onDeleted }: { engine: Engine; def: QueryDef | null; onSaved: (id: string) => void; onDeleted: () => void }) {
  const dflt = useMemo(() => chartDefault(engine), [engine]);
  const [name, setName] = useState(def?.name ?? ''); const [kind, setKind] = useState<QuerySource['kind']>(def?.source.kind ?? 'sheet'); const [header, setHeader] = useState(def?.header ?? true);
  const [ref, setRef] = useState(def?.source.kind === 'sheet' ? def.source.ref : dflt ? dflt.range : ''); const [text, setText] = useState(def && (def.source.kind === 'csv' || def.source.kind === 'json') ? def.source.text : ''); const [url, setUrl] = useState(def?.source.kind === 'url' ? def.source.url : '');
  const [fetched, setFetched] = useState<string | undefined>(); const [steps, setSteps] = useState<Step[]>(def?.steps ?? []); const [dest, setDest] = useState(def ? `${def.destSheet}!${def.anchor}` : ''); const [auto, setAuto] = useState(def?.auto ?? false); const [r, setR] = useState<Out | null>(null);
  const source: QuerySource = kind === 'sheet' ? { kind, ref } : kind === 'url' ? { kind, url } : { kind, text };
  const prev = useMemo(() => previewQuery(engine, { source, header, steps }, fetched), [engine, kind, ref, text, url, header, steps, fetched]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(() => previewQuery(engine, { source, header, steps: [] }, fetched).table, [engine, kind, ref, text, url, header, fetched]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = (steps.length ? runUpTo(base, steps, engine) : base)?.cols ?? [];
  const save = (): Out & { id?: string } => saveQuery(engine, { id: def?.id, name, source, header, steps, dest: dest || undefined, auto });
  return (
    <div className="stack">
      <div className="grid2"><Field label="Query name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales clean-up" /></Field>
        <Field label="Source"><select value={kind} onChange={(e) => { setKind(e.target.value as QuerySource['kind']); setFetched(undefined); }}><option value="sheet">Cells in this workbook</option><option value="csv">Pasted CSV / TSV text</option><option value="json">Pasted JSON</option><option value="url">Web address (CSV or JSON)</option></select></Field></div>
      {kind === 'sheet' && <Field label="Range (with header row)"><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. A1:F200 or Sheet2!A1:F200" /></Field>}
      {(kind === 'csv' || kind === 'json') && <Field label={kind === 'csv' ? 'Paste CSV text' : 'Paste JSON'}><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></Field>}
      {kind === 'url' && <div className="grid2" style={{ alignItems: 'end' }}><Field label="URL"><input value={url} onChange={(e) => { setUrl(e.target.value); setFetched(undefined); }} placeholder="https://…/data.csv" /></Field><div className="row-btns"><button onClick={async () => { const f = await fetchText(url); if (f.error) setR({ ok: false, message: f.error }); else { setFetched(f.text); setR({ ok: true, message: 'Downloaded' }); } }}>Fetch</button></div></div>}
      {kind !== 'json' && <Check label="First row contains column headers" checked={header} onChange={setHeader} />}
      <strong>Applied steps</strong>
      <ol className="steps">{steps.length === 0 && <li className="hint">No steps yet — add one below.</li>}
        {steps.map((s, i) => <li key={i} className={prev.failedAt === i ? 'bad' : ''}><span>{describeStep(s)}</span><button title="Move up" onClick={() => setSteps(move(steps, i, -1))}>↑</button><button title="Move down" onClick={() => setSteps(move(steps, i, 1))}>↓</button><button aria-label={`Delete step ${i + 1}`} onClick={() => setSteps(steps.filter((_, k) => k !== i))}>✕</button></li>)}</ol>
      <StepForm cols={cols} others={getQueries().filter((q) => q.id !== def?.id).map((q) => `query:${q.name}`)} onAdd={(s) => setSteps([...steps, s])} />
      <strong>Preview {prev.table ? `(${prev.table.rows.length} rows × ${prev.table.cols.length} columns)` : ''}</strong>
      {prev.error && <p className="msg" role="alert">{prev.error}</p>}
      {prev.table && <div className="qprev"><table><thead><tr>{prev.table.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{prev.table.rows.slice(0, 30).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{v === null || v === undefined ? '' : String(v)}</td>)}</tr>)}</tbody></table></div>}
      <div className="grid2"><Field label="Load to (first cell)"><input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="blank = right of the data" /></Field><Check label="Refresh automatically when source cells change" checked={auto} onChange={setAuto} /></div>
      <div className="row-btns">
        <button className="primary" onClick={async () => { const s = save(); if (!s.ok || !s.id) return setR(s); onSaved(s.id); const q = getQuery(s.id)!; setR(loadToSheet(engine, q, fetched ?? (q.source.kind === 'url' ? (await fetchText(q.source.url)).text : undefined))); }}>Save & load to sheet</button>
        <button onClick={() => { const s = save(); setR(s); if (s.id) onSaved(s.id); }}>Save query</button>
        {def && <button onClick={() => { setR(removeQuery(engine, def.id)); onDeleted(); }}>Delete query</button>}
        {def && def.last && <button onClick={() => { setR(removeQuery(engine, def.id, true)); onDeleted(); }}>Delete query and its output</button>}
      </div>
      <Result r={r} />
    </div>
  );
}
function runUpTo(base: Table | undefined, steps: Step[], engine: Engine): Table | undefined { void engine; if (!base) return undefined; let t = base; for (const s of steps) { const r = previewTable(t, s); if (!r) return t; t = r; } return t; }
import { applyStep } from './query';
function previewTable(t: Table, s: Step): Table | null { try { return applyStep(t, s, () => null); } catch { return null; } }

function StepForm({ cols, others, onAdd }: { cols: string[]; others: string[]; onAdd: (s: Step) => void }) {
  const [t, setT] = useState<Step['t']>('filter'); const [col, setCol] = useState(''); const [sel, setSel] = useState<string[]>([]); const [op, setOp] = useState<FilterOp>('='); const [val, setVal] = useState(''); const [val2, setVal2] = useState('');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc'); const [num, setNum] = useState('10'); const [from, setFrom] = useState<'top' | 'bottom'>('top'); const [to, setTo] = useState<'number' | 'text' | 'date' | 'boolean'>('number'); const [agg, setAgg] = useState<Agg>('sum'); const [aggCol, setAggCol] = useState(''); const [src, setSrc] = useState(''); const [rcol, setRcol] = useState(''); const [jk, setJk] = useState<'inner' | 'left'>('inner'); const [txt, setTxt] = useState<'trim' | 'upper' | 'lower' | 'proper' | 'clean'>('trim');
  const c0 = col || cols[0] || ''; const toggle = (c: string) => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c]);
  const multi = ['removeCols', 'keepCols', 'merge', 'unpivot', 'group', 'dedupe'].includes(t); const single = ['filter', 'rename', 'type', 'split', 'replace', 'text', 'fillDown', 'sort', 'join'].includes(t);
  const build = (): Step | null => {
    switch (t) {
      case 'filter': return { t, col: c0, op, value: val }; case 'removeCols': return sel.length ? { t, cols: sel } : null; case 'keepCols': return sel.length ? { t, cols: sel } : null; case 'rename': return val ? { t, from: c0, to: val } : null;
      case 'type': return { t, col: c0, to }; case 'sort': return { t, keys: [{ col: c0, dir }] }; case 'split': return val ? { t, col: c0, delim: val } : null; case 'merge': return sel.length > 1 && val2 ? { t, cols: sel, sep: val, name: val2 } : null;
      case 'addCol': return val && val2 ? { t, name: val, formula: val2 } : null; case 'replace': return val ? { t, col: c0, find: val, with: val2 } : null; case 'text': return { t, col: c0, op: txt }; case 'dedupe': return { t, cols: sel.length ? sel : undefined };
      case 'removeBlankRows': return { t }; case 'fillDown': return { t, col: c0 }; case 'keepRows': return { t, n: +num || 1, from }; case 'removeRows': return { t, n: +num || 1, from };
      case 'group': return { t, by: sel, aggs: [{ col: aggCol || c0, agg }] }; case 'unpivot': return sel.length ? { t, keep: sel, attr: 'Attribute', val: 'Value' } : null;
      case 'append': return src ? { t, src } : null; case 'join': return src && rcol ? { t, src, left: c0, right: rcol, kind: jk } : null;
    }
  };
  const step = build();
  return (
    <fieldset className="stepform"><legend>Add step</legend>
      <div className="grid2"><Field label="Transformation"><select value={t} onChange={(e) => { setT(e.target.value as Step['t']); setSel([]); }}>{STEP_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {single && <Field label={t === 'join' ? 'Column in this table' : 'Column'}><select value={c0} onChange={(e) => setCol(e.target.value)}>{cols.map((c) => <option key={c}>{c}</option>)}</select></Field>}</div>
      {multi && <div className="checks" aria-label="Columns">{cols.map((c) => <Check key={c} label={c} checked={sel.includes(c)} onChange={() => toggle(c)} />)}</div>}
      {t === 'filter' && <div className="grid2"><Field label="Condition"><select value={op} onChange={(e) => setOp(e.target.value as FilterOp)}>{OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>{!['isBlank', 'notBlank'].includes(op) && <Field label="Value"><input value={val} onChange={(e) => setVal(e.target.value)} /></Field>}</div>}
      {t === 'rename' && <Field label="New name"><input value={val} onChange={(e) => setVal(e.target.value)} /></Field>}
      {t === 'type' && <Field label="Type"><select value={to} onChange={(e) => setTo(e.target.value as typeof to)}><option value="number">Number</option><option value="text">Text</option><option value="date">Date</option><option value="boolean">True/False</option></select></Field>}
      {t === 'sort' && <Field label="Order"><select value={dir} onChange={(e) => setDir(e.target.value as 'asc' | 'desc')}><option value="asc">Ascending</option><option value="desc">Descending</option></select></Field>}
      {t === 'split' && <Field label="Delimiter"><input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. , or -" /></Field>}
      {t === 'merge' && <div className="grid2"><Field label="Separator"><input value={val} onChange={(e) => setVal(e.target.value)} /></Field><Field label="New column name"><input value={val2} onChange={(e) => setVal2(e.target.value)} /></Field></div>}
      {t === 'addCol' && <div className="grid2"><Field label="New column name"><input value={val} onChange={(e) => setVal(e.target.value)} /></Field><Field label="Formula (column names, + − * / ^)"><input value={val2} onChange={(e) => setVal2(e.target.value)} placeholder="Price * Qty" /></Field></div>}
      {t === 'replace' && <div className="grid2"><Field label="Find"><input value={val} onChange={(e) => setVal(e.target.value)} /></Field><Field label="Replace with"><input value={val2} onChange={(e) => setVal2(e.target.value)} /></Field></div>}
      {t === 'text' && <Field label="Operation"><select value={txt} onChange={(e) => setTxt(e.target.value as typeof txt)}><option value="trim">Trim</option><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="proper">Capitalize Each Word</option><option value="clean">Remove control characters</option></select></Field>}
      {(t === 'keepRows' || t === 'removeRows') && <div className="grid2"><Field label="Rows"><input type="number" min={1} value={num} onChange={(e) => setNum(e.target.value)} /></Field><Field label="From"><select value={from} onChange={(e) => setFrom(e.target.value as 'top' | 'bottom')}><option value="top">Top</option><option value="bottom">Bottom</option></select></Field></div>}
      {t === 'group' && <div className="grid2"><Field label="Summarize column"><select value={aggCol || c0} onChange={(e) => setAggCol(e.target.value)}>{cols.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Operation"><select value={agg} onChange={(e) => setAgg(e.target.value as Agg)}>{(Object.keys(AGG_LABEL) as Agg[]).map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}</select></Field></div>}
      {(t === 'append' || t === 'join') && <div className="grid2"><Field label="Other table (range like Sheet2!A1:D20, or a saved query)"><input list="qsrc" value={src} onChange={(e) => setSrc(e.target.value)} /></Field><datalist id="qsrc">{others.map((o) => <option key={o} value={o} />)}</datalist>
        {t === 'join' && <><Field label="Matching column in other table"><input value={rcol} onChange={(e) => setRcol(e.target.value)} /></Field><Field label="Join kind"><select value={jk} onChange={(e) => setJk(e.target.value as 'inner' | 'left')}><option value="inner">Inner (matches only)</option><option value="left">Left outer (keep all rows here)</option></select></Field></>}</div>}
      <div className="row-btns"><button disabled={!step} onClick={() => step && onAdd(step)}>Add step</button></div>
    </fieldset>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import Dialog from '../Dialog';
import type { Engine } from '../engine';
import { chartDefault } from '../charts/chartGlue';
import { PALETTE_NAMES } from '../charts/render';
import { renderSparkline, type SparkOpts } from './spark';
import { ICONS, renderShape, SHAPE_LABELS, type ShapeData, type ShapeKind } from './shapes';
import { DIAGRAM_KINDS, renderDiagram, type DiagramData, type DiagramKind } from './diagrams';
import { addCamera, addDiagram, addShape, clearSparklines, createSparklines, listObjects, removeObject, setSparkOpts, updateObject, type ObjInfo } from './objectGlue';
import { parseRef, readValues, type Out } from '../dataGlue';
import { CAMERA_KEY, DIAGRAM_KEY, SHAPE_KEY, SPARK_KEY } from './keys';

type Tab = 'spark' | 'shape' | 'icon' | 'diagram' | 'camera' | 'manage';
const TABS: [Tab, string][] = [['spark', 'Sparklines'], ['shape', 'Shapes & text'], ['icon', 'Icons'], ['diagram', 'Diagrams'], ['camera', 'Linked picture'], ['manage', 'Manage']];
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => <label className="inline"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
const Result = ({ r }: { r: Out | null }) => (r ? <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p> : null);
const Svg = ({ html, label }: { html: string; label: string }) => <div className="obj-preview" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;

export default function ObjectsDialog({ engine, initial = 'spark', onClose }: { engine: Engine; initial?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <Dialog title="Insert objects" onClose={onClose} wide>
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'spark' && <Spark engine={engine} />}
      {tab === 'shape' && <Shape engine={engine} />}
      {tab === 'icon' && <Icon engine={engine} />}
      {tab === 'diagram' && <Diagram engine={engine} />}
      {tab === 'camera' && <Camera engine={engine} />}
      {tab === 'manage' && <Manage engine={engine} />}
    </Dialog>
  );
}

function Spark({ engine }: { engine: Engine }) {
  const def = useMemo(() => chartDefault(engine), [engine]); const [src, setSrc] = useState(def?.range ?? ''); const [loc, setLoc] = useState(''); const [byCol, setByCol] = useState(false);
  const [o, setO] = useState<SparkOpts>({ kind: 'line', color: '#4472C4', markers: false }); const [r, setR] = useState<Out | null>(null);
  const sample = useMemo(() => { try { const l = src ? parseRef(engine, src) : null; if (!l) return [3, 6, 4, 9, 5, 8]; const g = readValues(l); const row = byCol ? g.map((x) => x[0]) : g[0]; return (row ?? []).map((v) => (typeof v === 'number' ? v : null)); } catch { return [3, 6, 4, 9, 5, 8]; } }, [engine, src, byCol]);
  const set = (p: Partial<SparkOpts>) => setO({ ...o, ...p });
  return (
    <div className="stack">
      <p className="hint">One sparkline is made for each row (or column) of the data range and placed in the location cells.</p>
      <div className="grid2"><Field label="Data range"><input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="e.g. B2:G6" /></Field><Field label="Location (first cell)"><input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. H2" /></Field></div>
      <div className="grid2"><Field label="Type"><select value={o.kind} onChange={(e) => set({ kind: e.target.value as SparkOpts['kind'] })}><option value="line">Line</option><option value="column">Column</option><option value="winloss">Win / Loss</option></select></Field><Field label="Color"><input type="color" value={o.color ?? '#4472C4'} onChange={(e) => set({ color: e.target.value })} /></Field></div>
      <div className="checks"><Check label="One per column" checked={byCol} onChange={setByCol} />{o.kind === 'line' && <Check label="Markers" checked={!!o.markers} onChange={(v) => set({ markers: v })} />}<Check label="High point" checked={!!o.high} onChange={(v) => set({ high: v })} /><Check label="Low point" checked={!!o.low} onChange={(v) => set({ low: v })} /><Check label="First point" checked={!!o.first} onChange={(v) => set({ first: v })} /><Check label="Last point" checked={!!o.last} onChange={(v) => set({ last: v })} /><Check label="Negative points" checked={!!o.negative} onChange={(v) => set({ negative: v })} /><Check label="Show axis" checked={!!o.axis} onChange={(v) => set({ axis: v })} /><Check label="Empty cells as zero" checked={o.emptyAs === 'zero'} onChange={(v) => set({ emptyAs: v ? 'zero' : 'gap' })} /></div>
      <Svg html={renderSparkline(sample, o, 220, 44)} label="Sparkline preview" />
      <div className="row-btns"><button className="primary" onClick={() => setR(createSparklines(engine, { src, loc, opts: o, byColumn: byCol }))}>Insert sparklines</button><button onClick={() => setR(setSparkOpts(engine, loc, o))} disabled={!loc}>Apply style to sparkline at location</button><button onClick={() => setR(clearSparklines(engine, 'selection'))}>Clear in selection</button><button onClick={() => setR(clearSparklines(engine, 'sheet'))}>Clear on sheet</button></div>
      <Result r={r} />
    </div>
  );
}

function ShapeForm({ d, setD }: { d: ShapeData; setD: (d: ShapeData) => void }) {
  const set = (p: Partial<ShapeData>) => setD({ ...d, ...p });
  return (
    <div className="stack">
      {d.kind !== 'icon' && d.kind !== 'line' && <Field label="Text"><textarea rows={2} value={d.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field>}
      <div className="grid2">
        {d.kind !== 'text' && d.kind !== 'line' && <Field label="Fill"><input type="color" value={d.fill ?? '#4472C4'} onChange={(e) => set({ fill: e.target.value })} /></Field>}
        {d.kind !== 'text' && <Field label="Outline"><input type="color" value={d.stroke ?? '#2F528F'} onChange={(e) => set({ stroke: e.target.value })} /></Field>}
        {d.kind !== 'icon' && d.kind !== 'line' && <Field label="Text color"><input type="color" value={d.color ?? (d.kind === 'text' ? '#222222' : '#ffffff')} onChange={(e) => set({ color: e.target.value })} /></Field>}
        {d.kind !== 'icon' && d.kind !== 'line' && <Field label="Font size"><input type="number" min={8} max={72} value={d.size ?? 14} onChange={(e) => set({ size: Math.min(72, Math.max(8, +e.target.value || 14)) })} /></Field>}
        <Field label="Outline width"><input type="number" min={0} max={12} value={d.strokeWidth ?? (d.kind === 'text' ? 0 : 2)} onChange={(e) => set({ strokeWidth: Math.max(0, +e.target.value || 0) })} /></Field>
        {d.kind !== 'icon' && d.kind !== 'line' && <Field label="Align"><select value={d.align ?? 'center'} onChange={(e) => set({ align: e.target.value as ShapeData['align'] })}><option>left</option><option>center</option><option>right</option></select></Field>}
      </div>
      <div className="checks"><Check label="Bold" checked={!!d.bold} onChange={(v) => set({ bold: v })} /><Check label="Italic" checked={!!d.italic} onChange={(v) => set({ italic: v })} /><Check label="Dashed outline" checked={!!d.dashed} onChange={(v) => set({ dashed: v })} /><Check label="Shadow" checked={!!d.shadow} onChange={(v) => set({ shadow: v })} /></div>
    </div>
  );
}
function Shape({ engine }: { engine: Engine }) {
  const [d, setD] = useState<ShapeData>({ kind: 'rect', text: 'Text', fill: '#4472C4' }); const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="chart-types" role="radiogroup" aria-label="Shape">{SHAPE_LABELS.map(([k, l]) => <button key={k} role="radio" aria-checked={d.kind === k} className={'ctype' + (d.kind === k ? ' on' : '')} onClick={() => setD({ ...d, kind: k as ShapeKind })} title={l}><span dangerouslySetInnerHTML={{ __html: renderShape({ kind: k as ShapeKind, fill: '#4472C4', text: k === 'text' ? 'Aa' : undefined }, 72, 48) }} /><small>{l}</small></button>)}</div>
      <div className="chart-form"><ShapeForm d={d} setD={setD} /><Svg html={renderShape(d, 260, 160)} label="Shape preview" /></div>
      <div className="row-btns"><button className="primary" onClick={() => setR(addShape(engine, d))}>Insert {d.kind === 'text' ? 'text box' : 'shape'}</button></div><Result r={r} />
    </>
  );
}
function Icon({ engine }: { engine: Engine }) {
  const [icon, setIcon] = useState('star'); const [d, setD] = useState<ShapeData>({ kind: 'icon', icon: 'star', stroke: '#333333', strokeWidth: 1.8 }); const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="icon-grid" role="radiogroup" aria-label="Icon">{Object.keys(ICONS).map((k) => <button key={k} role="radio" aria-checked={icon === k} className={'ctype' + (icon === k ? ' on' : '')} title={k} onClick={() => { setIcon(k); setD({ ...d, icon: k }); }}><span dangerouslySetInnerHTML={{ __html: renderShape({ kind: 'icon', icon: k, stroke: '#333' }, 40, 40) }} /></button>)}</div>
      <div className="chart-form"><ShapeForm d={d} setD={setD} /><Svg html={renderShape({ ...d, icon }, 120, 120)} label="Icon preview" /></div>
      <div className="row-btns"><button className="primary" onClick={() => setR(addShape(engine, { ...d, icon }))}>Insert icon</button></div><Result r={r} />
    </>
  );
}
function Diagram({ engine }: { engine: Engine }) {
  const [d, setD] = useState<DiagramData>({ kind: 'process', text: 'Plan\nBuild\nTest\nShip', palette: 'office' }); const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="chart-types" role="radiogroup" aria-label="Diagram type">{DIAGRAM_KINDS.map(([k, l]) => <button key={k} role="radio" aria-checked={d.kind === k} className={'ctype' + (d.kind === k ? ' on' : '')} onClick={() => setD({ ...d, kind: k as DiagramKind, text: k === 'hierarchy' && !/^\s/m.test(d.text) ? 'CEO\n  CTO\n    Dev\n    QA\n  CFO' : d.text })} title={l}><span dangerouslySetInnerHTML={{ __html: renderDiagram({ kind: k, text: k === 'hierarchy' ? 'A\n  B\n  C' : 'A\nB\nC', palette: d.palette }, 96, 62) }} /><small>{l}</small></button>)}</div>
      <div className="chart-form">
        <div className="stack">
          <Field label="Text (one item per line; indent 2 spaces for sub-items)"><textarea rows={8} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} /></Field>
          <div className="grid2"><Field label="Colors"><select value={d.palette ?? 'office'} onChange={(e) => setD({ ...d, palette: e.target.value })}>{PALETTE_NAMES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Theme"><select value={d.theme ?? 'light'} onChange={(e) => setD({ ...d, theme: e.target.value as 'light' | 'dark' })}><option>light</option><option>dark</option></select></Field></div>
        </div>
        <Svg html={renderDiagram(d, 440, 280)} label="Diagram preview" />
      </div>
      <div className="row-btns"><button className="primary" onClick={() => setR(addDiagram(engine, d))}>Insert diagram</button></div><Result r={r} />
    </>
  );
}
function Camera({ engine }: { engine: Engine }) {
  const def = useMemo(() => chartDefault(engine), [engine]); const [rg, setRg] = useState(def?.range ?? ''); const [r, setR] = useState<Out | null>(null);
  return (
    <div className="stack">
      <p className="hint">A linked picture is a live snapshot of a cell range: it keeps updating as the cells change (values, fills, bold, alignment).</p>
      <Field label="Range to photograph"><input value={rg} onChange={(e) => setRg(e.target.value)} placeholder="e.g. A1:D8" /></Field>
      <div className="row-btns"><button className="primary" onClick={() => setR(addCamera(engine, rg))}>Insert linked picture</button></div><Result r={r} />
    </div>
  );
}
function Manage({ engine }: { engine: Engine }) {
  const [list, setList] = useState<ObjInfo[]>(() => listObjects(engine, SHAPE_KEY, DIAGRAM_KEY, CAMERA_KEY, SPARK_KEY)); const [sel, setSel] = useState<string | null>(null); const [w, setW] = useState(''); const [h, setH] = useState(''); const [txt, setTxt] = useState(''); const [mv, setMv] = useState(''); const [r, setR] = useState<Out | null>(null);
  const cur = list.find((x) => x.id === sel);
  const reload = () => setList(listObjects(engine, SHAPE_KEY, DIAGRAM_KEY, CAMERA_KEY, SPARK_KEY));
  if (!list.length) return <p className="hint">No shapes, diagrams, sparklines or pictures yet.</p>;
  return (
    <>
      <ul className="chart-list">{list.map((c) => <li key={c.id}><button className={sel === c.id ? 'on' : ''} onClick={() => { setSel(c.id); setW(String(c.w)); setH(String(c.h)); setTxt(''); }}>{c.label} <small>· {c.sheet}</small></button></li>)}</ul>
      {cur && <div className="stack">
        <div className="grid2"><Field label="Width (px)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} /></Field><Field label="Height (px)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} /></Field></div>
        <Field label="Move to cell (top-left corner)"><input value={mv} onChange={(e) => setMv(e.target.value)} placeholder="e.g. H10 (blank = keep)" /></Field>
        {(cur.key === SHAPE_KEY || cur.key === DIAGRAM_KEY) && <Field label={cur.key === SHAPE_KEY ? 'New text (leave empty to keep)' : 'New outline text (leave empty to keep)'}><textarea rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} /></Field>}
        <div className="row-btns"><button className="primary" onClick={() => { setR(updateObject(engine, cur.id, { w: +w || undefined, h: +h || undefined, data: txt ? { text: txt } : undefined, at: mv || undefined })); setMv(''); reload(); }}>Apply</button><button onClick={() => { setR(removeObject(engine, cur.id)); setSel(null); reload(); }}>Delete</button></div>
      </div>}
      <Result r={r} />
    </>
  );
}

import { useState, useSyncExternalStore } from 'react';
import type { Engine } from '../engine';
import * as G from './i18nGlue';
import { REGIONS, sample, convertFormula, regionById } from './regional';

type Out = { ok: boolean; message: string };
const Result = ({ r }: { r: Out | null }) => (r ? <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p> : null);
export default function LangTab({ engine }: { engine: Engine }) {
  useSyncExternalStore(G.subscribe, G.version); const reg = G.getRegion(); const [r, setR] = useState<Out | null>(null); const [what, setWhat] = useState<'numbers' | 'dates' | 'both'>('both'); const [f, setF] = useState('=SUM(A1,B2,1.5)'); const [from, setFrom] = useState('en-US'); const [to, setTo] = useState(reg.id); const [busy, setBusy] = useState(false);
  return (
    <div>
      <h3>Interface language</h3>
      <div className="row"><select aria-label="Interface language" value={G.uiLang()} disabled={busy} onChange={async (e) => { setBusy(true); setR(await G.setUiLanguage(engine, e.target.value)); setBusy(false); }}>{G.UI_LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></div>
      <p className="hint">Changes the spreadsheet’s own menus and dialogs. Right-to-left languages mirror the layout. Draco’s own screens (top bar, menus, Tools) follow the language too in Hindi, Tamil, French, Spanish and German; other dialogs stay in English. Marking a sheet right-to-left is saved in the file (for Excel), but the grid itself still draws left to right here.</p>
      <h3>Sheet direction</h3>
      <div className="row"><button onClick={() => setR(G.setSheetRtl(engine, true))}>Right to left</button><button onClick={() => setR(G.setSheetRtl(engine, false))}>Left to right</button></div>
      <h3>Regional formats</h3>
      <div className="row"><select aria-label="Region" value={reg.id} onChange={(e) => { G.setRegion(e.target.value); setTo(e.target.value); }}>{REGIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <table className="chg" aria-label="Region preview"><tbody>{sample(reg).map(([k, v]) => <tr key={k}><td>{k}</td><td className="mono">{v}</td></tr>)}<tr><td>Week starts</td><td>{['Sunday', 'Monday', '', '', '', '', 'Saturday'][reg.firstDay]}</td></tr></tbody></table>
      <h3>Fix imported text</h3>
      <p className="hint">Select cells holding text like “1.234,56” or “31/12/2024” and convert them to real numbers and dates as written in the region above.</p>
      <div className="row"><select aria-label="Convert what" value={what} onChange={(e) => setWhat(e.target.value as typeof what)}><option value="both">Numbers and dates</option><option value="numbers">Numbers only</option><option value="dates">Dates only</option></select>
        <button onClick={() => { const d = G.convertSelection(engine, reg, what, true); setR(d); }}>Preview</button><button className="primary" onClick={() => setR(G.convertSelection(engine, reg, what))}>Convert selection</button></div>
      <div className="row"><button onClick={() => setR(G.applyRegionFormat(engine, reg, 'currency'))}>Format as {reg.currency.code}</button><button onClick={() => setR(G.applyRegionFormat(engine, reg, 'date'))}>Date as {reg.pattern}</button></div>
      <Result r={r} />
      <h3>Formula separators</h3>
      <div className="row"><select aria-label="Formula from" value={from} onChange={(e) => setFrom(e.target.value)}>{REGIONS.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select>→<select aria-label="Formula to" value={to} onChange={(e) => setTo(e.target.value)}>{REGIONS.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select></div>
      <input aria-label="Formula to convert" value={f} onChange={(e) => setF(e.target.value)} /><pre className="console" aria-label="Converted formula">{convertFormula(f, regionById(from), regionById(to))}</pre>
      <p className="hint">Draco stores formulas in the English form (commas), like every spreadsheet file. This helps when pasting formulas from a European Excel.</p>
    </div>
  );
}

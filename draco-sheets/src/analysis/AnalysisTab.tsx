import { useState, type ReactNode } from 'react';
import type { Engine } from '../engine';
import { TOOLS, run, type Opts, type Tool } from './analysisGlue';
type Out = { ok: boolean; message: string };
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
export default function AnalysisTab({ engine }: { engine: Engine }) {
  const [tool, setTool] = useState<Tool>('descriptive'); const [input, setInput] = useState(''); const [input2, setInput2] = useState(''); const [labels, setLabels] = useState(true); const [output, setOutput] = useState('');
  const [period, setPeriod] = useState(3); const [damping, setDamping] = useState(0.3); const [alpha, setAlpha] = useState(0.05); const [varA, setVarA] = useState(1); const [varB, setVarB] = useState(1); const [sampleN, setSampleN] = useState(10); const [periodic, setPeriodic] = useState(false); const [r, setR] = useState<Out | null>(null);
  const hint = TOOLS.find((t) => t[0] === tool)![2]; const needs2 = tool === 'regression' || tool === 'histogram';
  const go = () => { const o: Opts = { tool, input, input2: needs2 ? input2 : undefined, labels, output, period, damping, alpha, varA, varB, sampleN, periodic }; setR(run(engine, o)); };
  return (
    <div>
      <p className="hint">Excel's Analysis ToolPak: pick an analysis, point it at your data, and the report is written to a new sheet (or to the cell you choose).</p>
      <div className="grid2">
        <Field label="Analysis"><select aria-label="Analysis tool" value={tool} onChange={(e) => setTool(e.target.value as Tool)}>{TOOLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label={tool === 'regression' ? 'Input Y range' : 'Input range'}><input aria-label="Input range" placeholder={hint + ' e.g. A1:C20'} value={input} onChange={(e) => setInput(e.target.value)} /></Field>
        {needs2 && <Field label={tool === 'regression' ? 'Input X range' : 'Bin range'}><input aria-label="Second range" value={input2} onChange={(e) => setInput2(e.target.value)} /></Field>}
        <Field label="Output cell (blank = new sheet)"><input aria-label="Output cell" placeholder="e.g. H1" value={output} onChange={(e) => setOutput(e.target.value)} /></Field>
        {tool === 'movavg' && <Field label="Period"><input type="number" aria-label="Period" min={1} value={period} onChange={(e) => setPeriod(+e.target.value)} /></Field>}
        {tool === 'expsmooth' && <Field label="Damping factor"><input type="number" aria-label="Damping" min={0} max={1} step={0.05} value={damping} onChange={(e) => setDamping(+e.target.value)} /></Field>}
        {(tool.startsWith('ttest') || tool === 'anova') && <Field label="Alpha"><input type="number" aria-label="Alpha" min={0.001} max={0.5} step={0.01} value={alpha} onChange={(e) => setAlpha(+e.target.value)} /></Field>}
        {tool === 'ztest' && <><Field label="Variable 1 variance"><input type="number" aria-label="Variance 1" value={varA} onChange={(e) => setVarA(+e.target.value)} /></Field><Field label="Variable 2 variance"><input type="number" aria-label="Variance 2" value={varB} onChange={(e) => setVarB(+e.target.value)} /></Field></>}
        {tool === 'sampling' && <><Field label="Sample size / period"><input type="number" aria-label="Sample size" min={1} value={sampleN} onChange={(e) => setSampleN(+e.target.value)} /></Field><label className="chk"><input type="checkbox" aria-label="Periodic" checked={periodic} onChange={(e) => setPeriodic(e.target.checked)} />Periodic (every Nth value)</label></>}
      </div>
      <label className="chk"><input type="checkbox" aria-label="Labels in first row" checked={labels} onChange={(e) => setLabels(e.target.checked)} />Labels in first row</label>
      <div className="row-btns"><button className="primary" onClick={go}>Run analysis</button></div>
      {r && <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p>}
    </div>
  );
}

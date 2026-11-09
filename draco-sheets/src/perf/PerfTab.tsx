import { useState } from 'react';
import type { Engine } from '../core/engine';
import * as G from './perfGlue';
import { EXCEL_LIMITS, fmtCount, fmtMs, summarize, warnFor, type Step } from './perf';

export default function PerfTab({ engine }: { engine: Engine }) {
  const [size, setSize] = useState(G.sheetSize(engine));
  const [rows, setRows] = useState(100000);
  const [cols, setCols] = useState(6);
  const [prog, setProg] = useState<{ d: number; t: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const warn = warnFor(rows, cols);
  const sum = steps ? summarize(steps) : null;
  return (
    <div>
      <h3>Sheet size</h3>
      <p>
        This sheet has <b>{fmtCount(size.rows)}</b> rows × <b>{fmtCount(size.cols)}</b> columns. Excel’s limit is{' '}
        {fmtCount(EXCEL_LIMITS.rows)} × {fmtCount(EXCEL_LIMITS.cols)}.
      </p>
      <div className="row">
        <button
          onClick={() => {
            G.expandToExcelLimits(engine);
            setSize(G.sheetSize(engine));
            setMsg('Sheet expanded to the Excel limits');
          }}
        >
          Expand to Excel limits
        </button>
      </div>
      <p className="hint">
        Only the cells on screen are drawn, so an empty million-row sheet costs almost nothing. Cost comes from how many
        cells actually hold data.
      </p>
      <h3>Large data</h3>
      <div className="row">
        <label>
          Rows{' '}
          <input
            aria-label="Test rows"
            type="number"
            min={1}
            max={EXCEL_LIMITS.rows - 1}
            value={rows}
            onChange={(e) => setRows(Math.max(1, +e.target.value || 1))}
          />
        </label>
        <label>
          Columns{' '}
          <input
            aria-label="Test columns"
            type="number"
            min={1}
            max={60}
            value={cols}
            onChange={(e) => setCols(Math.min(60, Math.max(1, +e.target.value || 1)))}
          />
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg('');
            const r = await G.fillTestData(engine, { rows, cols, onProgress: (d, t) => setProg({ d, t }) });
            setBusy(false);
            setProg(null);
            setSize(G.sheetSize(engine));
            setMsg(`${r.message} in ${fmtMs(r.ms)}`);
          }}
        >
          Fill with test data
        </button>
        {busy && <button onClick={G.cancelFill}>Stop</button>}
      </div>
      {warn && <p className="hint">{warn}</p>}
      {prog && <progress aria-label="Progress" max={prog.t} value={prog.d} />}
      <h3>Benchmark</h3>
      <div className="row">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setSteps(null);
            setMsg('');
            const s = await G.benchmark(engine, Math.min(rows, 200000));
            setBusy(false);
            setSteps(s);
            setSize(G.sheetSize(engine));
          }}
        >
          Run benchmark
        </button>
        <span className="hint">Uses up to 200,000 rows and clears them afterwards.</span>
      </div>
      {steps && (
        <table className="chg" aria-label="Benchmark results">
          <tbody>
            {steps.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>
                  {s.ms ? fmtMs(s.ms) : ''}
                  {s.note ? ` ${s.note}` : ''}
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <b>Total</b>
              </td>
              <td>
                <b>{fmtMs(sum!.total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {msg && (
        <p className="hint okmsg" role="status">
          ✔ {msg}
        </p>
      )}
      <h3>Tips for big workbooks</h3>
      <ul className="hint">
        <li>Formulas calculate in a background worker, so typing stays responsive while they update.</li>
        <li>Prefer one formula over a whole range instead of thousands of single-cell formulas where you can.</li>
        <li>Very large workbooks save more slowly; export to .xlsx or .csv for archives.</li>
      </ul>
    </div>
  );
}

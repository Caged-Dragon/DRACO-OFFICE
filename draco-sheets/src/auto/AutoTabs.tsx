import { useState, useSyncExternalStore, type ReactNode } from 'react';
import * as A from './autoGlue';
import { SAMPLES } from './script';
import { describeOp, countCells } from './macros';

type Out = { ok: boolean; message: string };
const Result = ({ r }: { r: Out | null }) =>
  r ? (
    <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>
      {r.ok ? '✔ ' : ''}
      {r.message}
    </p>
  ) : null;
const useAuto = () => useSyncExternalStore(A.subscribe, A.version);
const Check = ({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="inline">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

export function MacrosTab({ openInScripts }: { openInScripts: (code: string, name: string) => void }) {
  useAuto();
  const [name, setName] = useState('My macro');
  const [rel, setRel] = useState(true);
  const [r, setR] = useState<Out | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const rec = A.recordingInfo();
  return (
    <div>
      <h3>Record</h3>
      <p className="hint">
        Press Record, make your edits and formatting in the sheet, then Stop. Replaying repeats those steps. Macros are
        saved inside this workbook.
      </p>
      {!rec ? (
        <div className="row">
          <input aria-label="Macro name" value={name} onChange={(e) => setName(e.target.value)} />
          <Check label="Relative to the selected cell" checked={rel} onChange={setRel} />
          <button className="primary" onClick={() => setR(A.startRecording(name, rel))}>
            ● Record
          </button>
        </div>
      ) : (
        <div className="row">
          <b role="status">
            ● Recording “{rec.name}” — {rec.steps} step{rec.steps === 1 ? '' : 's'}
          </b>
          <button className="primary" onClick={() => setR(A.stopRecording(true))}>
            ■ Stop & save
          </button>
          <button onClick={() => setR(A.stopRecording(false))}>Discard</button>
        </div>
      )}
      <Result r={r} />
      <h3>Saved macros ({A.getMacros().length})</h3>
      {!A.getMacros().length && <p className="hint">No macros yet.</p>}
      <ul className="thread-list">
        {A.getMacros().map((m) => (
          <li className="thread" key={m.id} data-macro={m.name}>
            <div className="thread-head">
              <b>{m.name}</b>
              <span className="muted">
                {m.ops.length} step{m.ops.length === 1 ? '' : 's'} · {countCells(m)} cells ·{' '}
                {m.relative ? 'relative' : 'absolute'}
              </span>
            </div>
            <div className="row">
              <button className="primary" disabled={!!rec} onClick={() => setR(A.runMacro(m.id))}>
                ▶ Run
              </button>
              <button onClick={() => setOpen(open === m.id ? null : m.id)}>Steps</button>
              <button onClick={() => openInScripts(A.macroScript(m.id), m.name)}>Convert to script</button>
              <Check label="Relative" checked={m.relative} onChange={(v) => A.setMacroRelative(m.id, v)} />
              <button
                onClick={() => {
                  const n = prompt('Rename macro', m.name);
                  if (n) setR(A.renameMacro(m.id, n));
                }}
              >
                Rename
              </button>
              <button onClick={() => setR(A.deleteMacro(m.id))}>Delete</button>
            </div>
            {open === m.id && (
              <ol className="steps">
                {m.ops.map((o, i) => (
                  <li key={i}>{describeOp(o)}</li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
      <p className="hint">
        Macros replay the recorded edits directly, so they can’t be undone with Ctrl+Z (like Excel macros). Save first
        if unsure.
      </p>
    </div>
  );
}

export function ScriptsTab({ seed }: { seed: { code: string; name: string } | null }) {
  useAuto();
  const [name, setName] = useState(seed?.name ?? 'My script');
  const [code, setCode] = useState(seed?.code ?? SAMPLES[0].code);
  const [logs, setLogs] = useState<Array<{ kind: string; text: string }>>([]);
  const [r, setR] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const [sid, setSid] = useState<string | undefined>();
  const run = async () => {
    setBusy(true);
    setLogs([]);
    setR(null);
    const res = await A.runScriptInWorker(code, 15000, (kind, text) => setLogs((l) => [...l, { kind, text }]));
    setBusy(false);
    setLogs(res.logs);
    setR({
      ok: res.ok,
      message: res.ok
        ? `Finished in ${res.ms} ms${res.value !== undefined ? ` — returned ${JSON.stringify(res.value)}` : ''}`
        : (res.error ?? 'Failed'),
    });
  };
  return (
    <div>
      <p className="hint">
        Scripts are JavaScript. They run in a separate worker with a <code>draco</code> object — they can read and
        change this workbook, but can’t reach the page, your files or the network. Use <code>await</code> for every
        call.
      </p>
      <div className="row">
        <label>
          Example{' '}
          <select
            aria-label="Script examples"
            value=""
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.name === e.target.value);
              if (s) {
                setCode(s.code);
                setName(s.name);
                setSid(undefined);
              }
            }}
          >
            <option value="">Choose…</option>
            {SAMPLES.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Saved{' '}
          <select
            aria-label="Saved scripts"
            value={sid ?? ''}
            onChange={(e) => {
              const s = A.getScripts().find((x) => x.id === e.target.value);
              if (s) {
                setCode(s.code);
                setName(s.name);
                setSid(s.id);
              }
            }}
          >
            <option value="">—</option>
            {A.getScripts().map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        aria-label="Script code"
        className="code-edit"
        spellCheck={false}
        rows={12}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <div className="row">
        <input aria-label="Script name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={busy} onClick={() => void run()}>
          ▶ Run
        </button>
        {busy && <button onClick={() => A.stopScript()}>Stop</button>}
        <button
          onClick={() => {
            const o = A.saveScript(name, code, sid);
            setR(o);
            if (o.ok) setSid(String(o.id));
          }}
        >
          Save
        </button>
        {sid && (
          <button
            onClick={() => {
              A.deleteScript(sid);
              setSid(undefined);
            }}
          >
            Delete
          </button>
        )}
      </div>
      <Result r={r} />
      {!!logs.length && (
        <pre className="console" aria-label="Script output">
          {logs.map((l, i) => (
            <div key={i} className={l.kind}>
              {l.text}
            </div>
          ))}
        </pre>
      )}
      <details>
        <summary>API reference</summary>
        <pre className="console">{`draco.sheet(name?)            → Sheet   (current sheet if no name)
sheet.range('A1:C3') / sheet.cell(row, col)
sheet.usedRange() · insertRows(at, n) · deleteRows(at, n) · activate() · rename(name)
range.values() · displayValues() · formulas() · value()
range.setValues([[…]]) · setValue(x) · setFormulas([[…]]) · setFormula('=A1*2')
range.format({ bold, italic, underline, color, background, fontSize, numberFormat, align, wrap })
range.clear() · select() · sort(col, ascending) · offset(rows, cols)
draco.selection() · sheets() · addSheet(name) · toast(msg) · sleep(ms) · log(…)`}</pre>
      </details>
    </div>
  );
}

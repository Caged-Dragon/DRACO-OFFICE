import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { describeStep, type Step } from '../query';
import {
  fetchText,
  getQueries,
  getQuery,
  loadToSheet,
  previewQuery,
  removeQuery,
  saveQuery,
  type QueryDef,
  type QuerySource,
} from '../queryGlue';
import { chartDefault } from '../../charts/chartGlue';
import type { Out } from '../../data/dataGlue';
import { StepForm } from './StepForm';
import { Check, Field, Result, move, runUpTo } from './shared';

export function Editor({
  engine,
  def,
  onSaved,
  onDeleted,
}: {
  engine: Engine;
  def: QueryDef | null;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const dflt = useMemo(() => chartDefault(engine), [engine]);
  const [name, setName] = useState(def?.name ?? '');
  const [kind, setKind] = useState<QuerySource['kind']>(def?.source.kind ?? 'sheet');
  const [header, setHeader] = useState(def?.header ?? true);
  const [ref, setRef] = useState(def?.source.kind === 'sheet' ? def.source.ref : dflt ? dflt.range : '');
  const [text, setText] = useState(
    def && (def.source.kind === 'csv' || def.source.kind === 'json') ? def.source.text : '',
  );
  const [url, setUrl] = useState(def?.source.kind === 'url' ? def.source.url : '');
  const [fetched, setFetched] = useState<string | undefined>();
  const [steps, setSteps] = useState<Step[]>(def?.steps ?? []);
  const [dest, setDest] = useState(def ? `${def.destSheet}!${def.anchor}` : '');
  const [auto, setAuto] = useState(def?.auto ?? false);
  const [r, setR] = useState<Out | null>(null);
  const source: QuerySource = kind === 'sheet' ? { kind, ref } : kind === 'url' ? { kind, url } : { kind, text };
  const prev = useMemo(
    () => previewQuery(engine, { source, header, steps }, fetched),
    [engine, kind, ref, text, url, header, steps, fetched],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(
    () => previewQuery(engine, { source, header, steps: [] }, fetched).table,
    [engine, kind, ref, text, url, header, fetched],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = (steps.length ? runUpTo(base, steps, engine) : base)?.cols ?? [];
  const save = (): Out & { id?: string } =>
    saveQuery(engine, { id: def?.id, name, source, header, steps, dest: dest || undefined, auto });
  return (
    <div className="stack">
      <div className="grid2">
        <Field label="Query name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales clean-up" />
        </Field>
        <Field label="Source">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as QuerySource['kind']);
              setFetched(undefined);
            }}
          >
            <option value="sheet">Cells in this workbook</option>
            <option value="csv">Pasted CSV / TSV text</option>
            <option value="json">Pasted JSON</option>
            <option value="url">Web address (CSV or JSON)</option>
          </select>
        </Field>
      </div>
      {kind === 'sheet' && (
        <Field label="Range (with header row)">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. A1:F200 or Sheet2!A1:F200" />
        </Field>
      )}
      {(kind === 'csv' || kind === 'json') && (
        <Field label={kind === 'csv' ? 'Paste CSV text' : 'Paste JSON'}>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      )}
      {kind === 'url' && (
        <div className="grid2" style={{ alignItems: 'end' }}>
          <Field label="URL">
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setFetched(undefined);
              }}
              placeholder="https://…/data.csv"
            />
          </Field>
          <div className="row-btns">
            <button
              onClick={async () => {
                const f = await fetchText(url);
                if (f.error) setR({ ok: false, message: f.error });
                else {
                  setFetched(f.text);
                  setR({ ok: true, message: 'Downloaded' });
                }
              }}
            >
              Fetch
            </button>
          </div>
        </div>
      )}
      {kind !== 'json' && <Check label="First row contains column headers" checked={header} onChange={setHeader} />}
      <strong>Applied steps</strong>
      <ol className="steps">
        {steps.length === 0 && <li className="hint">No steps yet — add one below.</li>}
        {steps.map((s, i) => (
          <li key={i} className={prev.failedAt === i ? 'bad' : ''}>
            <span>{describeStep(s)}</span>
            <button title="Move up" onClick={() => setSteps(move(steps, i, -1))}>
              ↑
            </button>
            <button title="Move down" onClick={() => setSteps(move(steps, i, 1))}>
              ↓
            </button>
            <button aria-label={`Delete step ${i + 1}`} onClick={() => setSteps(steps.filter((_, k) => k !== i))}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      <StepForm
        cols={cols}
        others={getQueries()
          .filter((q) => q.id !== def?.id)
          .map((q) => `query:${q.name}`)}
        onAdd={(s) => setSteps([...steps, s])}
      />
      <strong>
        Preview {prev.table ? `(${prev.table.rows.length} rows × ${prev.table.cols.length} columns)` : ''}
      </strong>
      {prev.error && (
        <p className="msg" role="alert">
          {prev.error}
        </p>
      )}
      {prev.table && (
        <div className="qprev">
          <table>
            <thead>
              <tr>
                {prev.table.cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prev.table.rows.slice(0, 30).map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j}>{v === null || v === undefined ? '' : String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid2">
        <Field label="Load to (first cell)">
          <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="blank = right of the data" />
        </Field>
        <Check label="Refresh automatically when source cells change" checked={auto} onChange={setAuto} />
      </div>
      <div className="row-btns">
        <button
          className="primary"
          onClick={async () => {
            const s = save();
            if (!s.ok || !s.id) return setR(s);
            onSaved(s.id);
            const q = getQuery(s.id)!;
            setR(
              loadToSheet(
                engine,
                q,
                fetched ?? (q.source.kind === 'url' ? (await fetchText(q.source.url)).text : undefined),
              ),
            );
          }}
        >
          Save & load to sheet
        </button>
        <button
          onClick={() => {
            const s = save();
            setR(s);
            if (s.id) onSaved(s.id);
          }}
        >
          Save query
        </button>
        {def && (
          <button
            onClick={() => {
              setR(removeQuery(engine, def.id));
              onDeleted();
            }}
          >
            Delete query
          </button>
        )}
        {def && def.last && (
          <button
            onClick={() => {
              setR(removeQuery(engine, def.id, true));
              onDeleted();
            }}
          >
            Delete query and its output
          </button>
        )}
      </div>
      <Result r={r} />
    </div>
  );
}

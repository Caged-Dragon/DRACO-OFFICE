import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { listNames, removeName, saveName, selectionRef, validateName, type NameRow } from '../formulaTools';

export function Names({ engine }: { engine: Engine }) {
  const [rows, setRows] = useState<NameRow[]>(() => listNames(engine));
  const [name, setName] = useState('');
  const [ref, setRef] = useState(() => selectionRef(engine));
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState<string | undefined>();
  const [err, setErr] = useState('');
  const refresh = () => setRows(listNames(engine));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bad =
      validateName(
        name,
        rows.map((r) => r.name),
        editing,
      ) ?? (!ref.trim() ? 'Enter what the name refers to.' : null);
    if (bad) return setErr(bad);
    try {
      saveName(engine, name, ref, comment, editing);
    } catch (x) {
      return setErr(String((x as Error).message ?? x));
    }
    setName('');
    setComment('');
    setEditing(undefined);
    setErr('');
    refresh();
  };
  return (
    <>
      <form onSubmit={submit} className="stack" aria-label="Define name">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SalesData" />
        </label>
        <label>
          Refers to
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Sheet1!$B$1:$B$5 or =A1*2" />
        </label>
        <label>
          Comment (optional)
          <input value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <div className="row-btns">
          <button className="primary">{editing ? 'Update name' : 'Add name'}</button>
          <button type="button" onClick={() => setRef(selectionRef(engine))}>
            Use current selection
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(undefined);
                setName('');
                setComment('');
                setErr('');
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
        {err && (
          <p className="msg" role="alert">
            {err}
          </p>
        )}
      </form>
      <h3>Defined names ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="hint">
          No names yet. Select cells, name them above, then use the name in formulas: <code>=SUM(SalesData)</code>
        </p>
      ) : (
        <ul className="filelist">
          {rows.map((r) => (
            <li key={r.name}>
              <button
                className="row"
                onClick={() => {
                  setEditing(r.name);
                  setName(r.name);
                  setRef(r.ref);
                  setComment(r.comment);
                  setErr('');
                }}
              >
                <span className="name">{r.name}</span>
                <span className="meta">
                  {r.ref}
                  {r.comment ? ` · ${r.comment}` : ''}
                </span>
              </button>
              <button
                className="icon"
                aria-label={`Delete name ${r.name}`}
                onClick={() => {
                  removeName(engine, r.name);
                  refresh();
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

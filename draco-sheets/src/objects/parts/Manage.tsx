import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { listObjects, removeObject, updateObject, type ObjInfo } from '../objectGlue';
import { type Out } from '../../data/dataGlue';
import { CAMERA_KEY, DIAGRAM_KEY, SHAPE_KEY, SPARK_KEY } from '../keys';
import { Field, Result } from './shared';

export function Manage({ engine }: { engine: Engine }) {
  const [list, setList] = useState<ObjInfo[]>(() => listObjects(engine, SHAPE_KEY, DIAGRAM_KEY, CAMERA_KEY, SPARK_KEY));
  const [sel, setSel] = useState<string | null>(null);
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [txt, setTxt] = useState('');
  const [mv, setMv] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const cur = list.find((x) => x.id === sel);
  const reload = () => setList(listObjects(engine, SHAPE_KEY, DIAGRAM_KEY, CAMERA_KEY, SPARK_KEY));
  if (!list.length) return <p className="hint">No shapes, diagrams, sparklines or pictures yet.</p>;
  return (
    <>
      <ul className="chart-list">
        {list.map((c) => (
          <li key={c.id}>
            <button
              className={sel === c.id ? 'on' : ''}
              onClick={() => {
                setSel(c.id);
                setW(String(c.w));
                setH(String(c.h));
                setTxt('');
              }}
            >
              {c.label} <small>· {c.sheet}</small>
            </button>
          </li>
        ))}
      </ul>
      {cur && (
        <div className="stack">
          <div className="grid2">
            <Field label="Width (px)">
              <input type="number" value={w} onChange={(e) => setW(e.target.value)} />
            </Field>
            <Field label="Height (px)">
              <input type="number" value={h} onChange={(e) => setH(e.target.value)} />
            </Field>
          </div>
          <Field label="Move to cell (top-left corner)">
            <input value={mv} onChange={(e) => setMv(e.target.value)} placeholder="e.g. H10 (blank = keep)" />
          </Field>
          {(cur.key === SHAPE_KEY || cur.key === DIAGRAM_KEY) && (
            <Field
              label={
                cur.key === SHAPE_KEY ? 'New text (leave empty to keep)' : 'New outline text (leave empty to keep)'
              }
            >
              <textarea rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} />
            </Field>
          )}
          <div className="row-btns">
            <button
              className="primary"
              onClick={() => {
                setR(
                  updateObject(engine, cur.id, {
                    w: +w || undefined,
                    h: +h || undefined,
                    data: txt ? { text: txt } : undefined,
                    at: mv || undefined,
                  }),
                );
                setMv('');
                reload();
              }}
            >
              Apply
            </button>
            <button
              onClick={() => {
                setR(removeObject(engine, cur.id));
                setSel(null);
                reload();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <Result r={r} />
    </>
  );
}

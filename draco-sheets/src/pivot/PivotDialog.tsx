import { useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { type Out } from '../data/dataGlue';
import { getPivot, getPivots, type PivotDef } from './pivotGlue';
import { Editor } from './parts/Editor';
import { NewPivot } from './parts/NewPivot';
import { Result } from './parts/shared';

export default function PivotDialog({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [list, setList] = useState<PivotDef[]>(() => [...getPivots()]);
  const [sel, setSel] = useState<string | null>(() => getPivots()[0]?.id ?? null);
  const [r, setR] = useState<Out | null>(null);
  const reload = () => setList([...getPivots()]);
  const def = sel ? getPivot(sel) : null;
  return (
    <Dialog title="PivotTables" onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="PivotTables">
        {list.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={sel === p.id}
            className={sel === p.id ? 'on' : ''}
            onClick={() => {
              setSel(p.id);
              setR(null);
            }}
          >
            {p.name}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={sel === null}
          className={sel === null ? 'on' : ''}
          onClick={() => {
            setSel(null);
            setR(null);
          }}
        >
          ＋ New PivotTable
        </button>
      </div>
      {!def && (
        <NewPivot
          engine={engine}
          onCreated={(id, out) => {
            reload();
            setSel(id);
            setR(out);
          }}
        />
      )}
      {def && (
        <Editor
          key={def.id}
          engine={engine}
          def={def}
          onChange={reload}
          onDeleted={() => {
            reload();
            setSel(null);
          }}
        />
      )}
      <Result r={r} />
    </Dialog>
  );
}

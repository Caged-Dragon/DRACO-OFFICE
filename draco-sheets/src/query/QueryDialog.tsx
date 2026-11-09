import { useState } from 'react';
import Dialog from '../ui/Dialog';
import type { Engine } from '../core/engine';
import { getQueries, getQuery, refreshAllQueries, type QueryDef } from './queryGlue';
import type { Out } from '../data/dataGlue';
import { Editor } from './parts/Editor';
import { Result } from './parts/shared';

export default function QueryDialog({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [list, setList] = useState<QueryDef[]>(() => [...getQueries()]);
  const [sel, setSel] = useState<string | null>(() => getQueries()[0]?.id ?? null);
  const [r, setR] = useState<Out | null>(null);
  const reload = () => setList([...getQueries()]);
  return (
    <Dialog title="Queries (import & transform)" onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Queries">
        {list.map((q) => (
          <button
            key={q.id}
            role="tab"
            aria-selected={sel === q.id}
            className={sel === q.id ? 'on' : ''}
            onClick={() => {
              setSel(q.id);
              setR(null);
            }}
          >
            {q.name}
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
          ＋ New query
        </button>
        {list.length > 0 && (
          <button
            onClick={async () => {
              setR(await refreshAllQueries(engine));
            }}
          >
            Refresh all
          </button>
        )}
      </div>
      <Editor
        key={sel ?? 'new'}
        engine={engine}
        def={sel ? getQuery(sel) : null}
        onSaved={(id) => {
          reload();
          setSel(id);
        }}
        onDeleted={() => {
          reload();
          setSel(null);
        }}
      />
      <Result r={r} />
    </Dialog>
  );
}

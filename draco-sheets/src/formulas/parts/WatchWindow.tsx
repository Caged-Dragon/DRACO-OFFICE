import { useEffect, useState } from 'react';
import type { Engine } from '../../core/engine';
import { a1 } from '../audit';
import { activeCell, cellInfo } from '../formulaTools';
import { WATCH_KEY, Watch, loadWatch } from './shared';

export function WatchWindow({ engine, jump }: { engine: Engine; jump: (s: string, r: number, c: number) => void }) {
  const [list, setList] = useState<Watch[]>(loadWatch);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const save = (l: Watch[]) => {
    setList(l);
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(l));
    } catch {
      /* storage unavailable */
    }
  };
  const add = () => {
    const c = activeCell(engine);
    if (c && !list.some((w) => w.sheet === c.sheet && w.row === c.row && w.col === c.col)) save([...list, c]);
  };
  return (
    <>
      <div className="row-btns">
        <button className="primary" onClick={add}>
          Add watch for current cell
        </button>
      </div>
      {list.length === 0 ? (
        <p className="hint">Watch cells here and see their values update live while you work on other sheets.</p>
      ) : (
        <table className="watch">
          <thead>
            <tr>
              <th>Sheet</th>
              <th>Cell</th>
              <th>Value</th>
              <th>Formula</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((w, i) => {
              const info = cellInfo(engine, w.sheet, w.row, w.col);
              return (
                <tr key={i}>
                  <td>{w.sheet}</td>
                  <td>
                    <button className="link" onClick={() => jump(w.sheet, w.row, w.col)}>
                      {a1(w.row, w.col)}
                    </button>
                  </td>
                  <td>{info.value}</td>
                  <td className="mono">{info.formula}</td>
                  <td>
                    <button
                      className="icon"
                      aria-label={`Remove watch ${a1(w.row, w.col)}`}
                      onClick={() => save(list.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

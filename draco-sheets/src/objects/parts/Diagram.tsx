import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { PALETTE_NAMES } from '../../charts/render';
import { DIAGRAM_KINDS, renderDiagram, type DiagramData, type DiagramKind } from '../diagrams';
import { addDiagram } from '../objectGlue';
import { type Out } from '../../data/dataGlue';
import { Field, Result, Svg } from './shared';

export function Diagram({ engine }: { engine: Engine }) {
  const [d, setD] = useState<DiagramData>({ kind: 'process', text: 'Plan\nBuild\nTest\nShip', palette: 'office' });
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="chart-types" role="radiogroup" aria-label="Diagram type">
        {DIAGRAM_KINDS.map(([k, l]) => (
          <button
            key={k}
            role="radio"
            aria-checked={d.kind === k}
            className={'ctype' + (d.kind === k ? ' on' : '')}
            onClick={() =>
              setD({
                ...d,
                kind: k as DiagramKind,
                text: k === 'hierarchy' && !/^\s/m.test(d.text) ? 'CEO\n  CTO\n    Dev\n    QA\n  CFO' : d.text,
              })
            }
            title={l}
          >
            <span
              dangerouslySetInnerHTML={{
                __html: renderDiagram(
                  { kind: k, text: k === 'hierarchy' ? 'A\n  B\n  C' : 'A\nB\nC', palette: d.palette },
                  96,
                  62,
                ),
              }}
            />
            <small>{l}</small>
          </button>
        ))}
      </div>
      <div className="chart-form">
        <div className="stack">
          <Field label="Text (one item per line; indent 2 spaces for sub-items)">
            <textarea rows={8} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Colors">
              <select value={d.palette ?? 'office'} onChange={(e) => setD({ ...d, palette: e.target.value })}>
                {PALETTE_NAMES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Theme">
              <select
                value={d.theme ?? 'light'}
                onChange={(e) => setD({ ...d, theme: e.target.value as 'light' | 'dark' })}
              >
                <option>light</option>
                <option>dark</option>
              </select>
            </Field>
          </div>
        </div>
        <Svg html={renderDiagram(d, 440, 280)} label="Diagram preview" />
      </div>
      <div className="row-btns">
        <button className="primary" onClick={() => setR(addDiagram(engine, d))}>
          Insert diagram
        </button>
      </div>
      <Result r={r} />
    </>
  );
}

import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { renderShape, SHAPE_LABELS, type ShapeData, type ShapeKind } from '../shapes';
import { addShape } from '../objectGlue';
import { type Out } from '../../data/dataGlue';
import { ShapeForm } from './ShapeForm';
import { Result, Svg } from './shared';

export function Shape({ engine }: { engine: Engine }) {
  const [d, setD] = useState<ShapeData>({ kind: 'rect', text: 'Text', fill: '#4472C4' });
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="chart-types" role="radiogroup" aria-label="Shape">
        {SHAPE_LABELS.map(([k, l]) => (
          <button
            key={k}
            role="radio"
            aria-checked={d.kind === k}
            className={'ctype' + (d.kind === k ? ' on' : '')}
            onClick={() => setD({ ...d, kind: k as ShapeKind })}
            title={l}
          >
            <span
              dangerouslySetInnerHTML={{
                __html: renderShape(
                  { kind: k as ShapeKind, fill: '#4472C4', text: k === 'text' ? 'Aa' : undefined },
                  72,
                  48,
                ),
              }}
            />
            <small>{l}</small>
          </button>
        ))}
      </div>
      <div className="chart-form">
        <ShapeForm d={d} setD={setD} />
        <Svg html={renderShape(d, 260, 160)} label="Shape preview" />
      </div>
      <div className="row-btns">
        <button className="primary" onClick={() => setR(addShape(engine, d))}>
          Insert {d.kind === 'text' ? 'text box' : 'shape'}
        </button>
      </div>
      <Result r={r} />
    </>
  );
}

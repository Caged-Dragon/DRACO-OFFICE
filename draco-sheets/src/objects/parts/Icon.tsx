import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { ICONS, renderShape, type ShapeData } from '../shapes';
import { addShape } from '../objectGlue';
import { type Out } from '../../data/dataGlue';
import { ShapeForm } from './ShapeForm';
import { Result, Svg } from './shared';

export function Icon({ engine }: { engine: Engine }) {
  const [icon, setIcon] = useState('star');
  const [d, setD] = useState<ShapeData>({ kind: 'icon', icon: 'star', stroke: '#333333', strokeWidth: 1.8 });
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <div className="icon-grid" role="radiogroup" aria-label="Icon">
        {Object.keys(ICONS).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={icon === k}
            className={'ctype' + (icon === k ? ' on' : '')}
            title={k}
            onClick={() => {
              setIcon(k);
              setD({ ...d, icon: k });
            }}
          >
            <span
              dangerouslySetInnerHTML={{ __html: renderShape({ kind: 'icon', icon: k, stroke: '#333' }, 40, 40) }}
            />
          </button>
        ))}
      </div>
      <div className="chart-form">
        <ShapeForm d={d} setD={setD} />
        <Svg html={renderShape({ ...d, icon }, 120, 120)} label="Icon preview" />
      </div>
      <div className="row-btns">
        <button className="primary" onClick={() => setR(addShape(engine, { ...d, icon }))}>
          Insert icon
        </button>
      </div>
      <Result r={r} />
    </>
  );
}

import { useState } from 'react';
import type { Engine } from '../../core/engine';
import { TABLE_STYLES } from '../dataTools';
import { clearTableRun, formatAsTableRun, type Out } from '../dataGlue';
import { Check, Result } from './shared';

export function TableTab({ engine }: { engine: Engine }) {
  const [s, setS] = useState(0);
  const [band, setBand] = useState(true);
  const [tot, setTot] = useState(false);
  const [fil, setFil] = useState(true);
  const [r, setR] = useState<Out | null>(null);
  return (
    <>
      <p className="hint">
        Formats the selected range (or the region around the active cell) as a styled table with a header row.
      </p>
      <div className="swatches">
        {TABLE_STYLES.map((t, i) => (
          <button
            key={t.name}
            className="swatch"
            aria-pressed={s === i}
            style={{
              background: t.header.bg,
              color: t.header.fg,
              outline: s === i ? '3px solid var(--accent)' : undefined,
              fontWeight: 700,
            }}
            onClick={() => setS(i)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <Check label="Banded rows" checked={band} onChange={setBand} />{' '}
      <Check label="Total row (bold last row)" checked={tot} onChange={setTot} />{' '}
      <Check label="Filter buttons" checked={fil} onChange={setFil} />
      <div className="row-btns">
        <button
          className="primary"
          onClick={() => setR(formatAsTableRun(engine, s, { banded: band, totalRow: tot, filter: fil }))}
        >
          Format as table
        </button>
        <button onClick={() => setR(clearTableRun(engine))}>Clear table style</button>
      </div>
      <Result r={r} />
    </>
  );
}

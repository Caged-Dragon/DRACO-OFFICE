import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import { colName, dedupeRunAsync, targetLoc, readDisplay, type Out } from '../dataGlue';
import { Check, Result } from './shared';

export function Dupes({ engine }: { engine: Engine }) {
  const [hdr, setHdr] = useState(true);
  const [cs, setCs] = useState(false);
  const [r, setR] = useState<Out | null>(null);
  const loc = useMemo(() => targetLoc(engine), [engine]);
  const heads = useMemo(
    () =>
      loc
        ? (readDisplay({ ...loc, rng: loc.sheet.getRange(loc.r0, loc.c0, 1, loc.cols) }) as unknown[][])[0].map(
            (h, i) => (hdr && h ? String(h) : `Column ${colName(loc.c0 + i)}`),
          )
        : [],
    [loc, hdr],
  );
  const [cols, setCols] = useState<boolean[] | null>(null);
  const sel = cols ?? heads.map(() => true);
  if (!loc) return <p>Select a range first.</p>;
  return (
    <>
      <p className="hint">
        Range:{' '}
        <b>
          {loc.sheet.getSheetName()}!{colName(loc.c0)}
          {loc.r0 + 1}:{colName(loc.c0 + loc.cols - 1)}
          {loc.r0 + loc.rows}
        </b>
      </p>
      <Check label="My data has headers" checked={hdr} onChange={setHdr} />
      <Check label="Match case" checked={cs} onChange={setCs} />
      <p className="hint">Columns to compare:</p>
      <div className="checks">
        {heads.map((h, i) => (
          <Check key={i} label={h} checked={sel[i]} onChange={(v) => setCols(sel.map((x, j) => (j === i ? v : x)))} />
        ))}
      </div>
      <div className="row-btns">
        <button
          className="primary"
          onClick={async () => {
            setR({ ok: true, message: 'Working in the background…' });
            setR(
              await dedupeRunAsync(
                engine,
                sel.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
                hdr,
                cs,
              ),
            );
          }}
        >
          Remove duplicates
        </button>
      </div>
      <Result r={r} />
    </>
  );
}

import { useMemo } from 'react';
import type { Engine } from '../../core/engine';
import { type PivotConfig } from '../pivot';
import { sourceItems, type PivotDef } from '../pivotGlue';
import { Check } from './shared';

export function FilterBox({
  engine,
  def,
  cfg,
  f,
  onChange,
  onRemove,
}: {
  engine: Engine;
  def: PivotDef;
  cfg: PivotConfig;
  f: PivotConfig['filters'][number];
  onChange: (ex: string[]) => void;
  onRemove: () => void;
}) {
  const items = useMemo(() => sourceItems(engine, { ...def, cfg }, f.field), [engine, def, f.field]); // eslint-disable-line react-hooks/exhaustive-deps
  const ex = new Set(f.exclude);
  return (
    <fieldset className="filterbox">
      <legend>
        {f.field}{' '}
        <button aria-label={`Remove filter ${f.field}`} onClick={onRemove}>
          ✕
        </button>
      </legend>
      <div className="row-btns">
        <button onClick={() => onChange([])}>Select all</button>
        <button onClick={() => onChange(items)}>Clear</button>
      </div>
      <div className="checks">
        {items.map((it) => (
          <Check
            key={it}
            label={it}
            checked={!ex.has(it)}
            onChange={(v) => onChange(v ? f.exclude.filter((x) => x !== it) : [...f.exclude, it])}
          />
        ))}
      </div>
    </fieldset>
  );
}

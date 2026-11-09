import { useState } from 'react';
import { type FilterOp, type Step } from '../query';
import { AGG_LABEL, type Agg } from '../../pivot/pivot';
import { Check, Field, OPS, STEP_TYPES } from './shared';

export function StepForm({ cols, others, onAdd }: { cols: string[]; others: string[]; onAdd: (s: Step) => void }) {
  const [t, setT] = useState<Step['t']>('filter');
  const [col, setCol] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [op, setOp] = useState<FilterOp>('=');
  const [val, setVal] = useState('');
  const [val2, setVal2] = useState('');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [num, setNum] = useState('10');
  const [from, setFrom] = useState<'top' | 'bottom'>('top');
  const [to, setTo] = useState<'number' | 'text' | 'date' | 'boolean'>('number');
  const [agg, setAgg] = useState<Agg>('sum');
  const [aggCol, setAggCol] = useState('');
  const [src, setSrc] = useState('');
  const [rcol, setRcol] = useState('');
  const [jk, setJk] = useState<'inner' | 'left'>('inner');
  const [txt, setTxt] = useState<'trim' | 'upper' | 'lower' | 'proper' | 'clean'>('trim');
  const c0 = col || cols[0] || '';
  const toggle = (c: string) => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c]);
  const multi = ['removeCols', 'keepCols', 'merge', 'unpivot', 'group', 'dedupe'].includes(t);
  const single = ['filter', 'rename', 'type', 'split', 'replace', 'text', 'fillDown', 'sort', 'join'].includes(t);
  const build = (): Step | null => {
    switch (t) {
      case 'filter':
        return { t, col: c0, op, value: val };
      case 'removeCols':
        return sel.length ? { t, cols: sel } : null;
      case 'keepCols':
        return sel.length ? { t, cols: sel } : null;
      case 'rename':
        return val ? { t, from: c0, to: val } : null;
      case 'type':
        return { t, col: c0, to };
      case 'sort':
        return { t, keys: [{ col: c0, dir }] };
      case 'split':
        return val ? { t, col: c0, delim: val } : null;
      case 'merge':
        return sel.length > 1 && val2 ? { t, cols: sel, sep: val, name: val2 } : null;
      case 'addCol':
        return val && val2 ? { t, name: val, formula: val2 } : null;
      case 'replace':
        return val ? { t, col: c0, find: val, with: val2 } : null;
      case 'text':
        return { t, col: c0, op: txt };
      case 'dedupe':
        return { t, cols: sel.length ? sel : undefined };
      case 'removeBlankRows':
        return { t };
      case 'fillDown':
        return { t, col: c0 };
      case 'keepRows':
        return { t, n: +num || 1, from };
      case 'removeRows':
        return { t, n: +num || 1, from };
      case 'group':
        return { t, by: sel, aggs: [{ col: aggCol || c0, agg }] };
      case 'unpivot':
        return sel.length ? { t, keep: sel, attr: 'Attribute', val: 'Value' } : null;
      case 'append':
        return src ? { t, src } : null;
      case 'join':
        return src && rcol ? { t, src, left: c0, right: rcol, kind: jk } : null;
    }
  };
  const step = build();
  return (
    <fieldset className="stepform">
      <legend>Add step</legend>
      <div className="grid2">
        <Field label="Transformation">
          <select
            value={t}
            onChange={(e) => {
              setT(e.target.value as Step['t']);
              setSel([]);
            }}
          >
            {STEP_TYPES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {single && (
          <Field label={t === 'join' ? 'Column in this table' : 'Column'}>
            <select value={c0} onChange={(e) => setCol(e.target.value)}>
              {cols.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {multi && (
        <div className="checks" aria-label="Columns">
          {cols.map((c) => (
            <Check key={c} label={c} checked={sel.includes(c)} onChange={() => toggle(c)} />
          ))}
        </div>
      )}
      {t === 'filter' && (
        <div className="grid2">
          <Field label="Condition">
            <select value={op} onChange={(e) => setOp(e.target.value as FilterOp)}>
              {OPS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {!['isBlank', 'notBlank'].includes(op) && (
            <Field label="Value">
              <input value={val} onChange={(e) => setVal(e.target.value)} />
            </Field>
          )}
        </div>
      )}
      {t === 'rename' && (
        <Field label="New name">
          <input value={val} onChange={(e) => setVal(e.target.value)} />
        </Field>
      )}
      {t === 'type' && (
        <Field label="Type">
          <select value={to} onChange={(e) => setTo(e.target.value as typeof to)}>
            <option value="number">Number</option>
            <option value="text">Text</option>
            <option value="date">Date</option>
            <option value="boolean">True/False</option>
          </select>
        </Field>
      )}
      {t === 'sort' && (
        <Field label="Order">
          <select value={dir} onChange={(e) => setDir(e.target.value as 'asc' | 'desc')}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </Field>
      )}
      {t === 'split' && (
        <Field label="Delimiter">
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. , or -" />
        </Field>
      )}
      {t === 'merge' && (
        <div className="grid2">
          <Field label="Separator">
            <input value={val} onChange={(e) => setVal(e.target.value)} />
          </Field>
          <Field label="New column name">
            <input value={val2} onChange={(e) => setVal2(e.target.value)} />
          </Field>
        </div>
      )}
      {t === 'addCol' && (
        <div className="grid2">
          <Field label="New column name">
            <input value={val} onChange={(e) => setVal(e.target.value)} />
          </Field>
          <Field label="Formula (column names, + − * / ^)">
            <input value={val2} onChange={(e) => setVal2(e.target.value)} placeholder="Price * Qty" />
          </Field>
        </div>
      )}
      {t === 'replace' && (
        <div className="grid2">
          <Field label="Find">
            <input value={val} onChange={(e) => setVal(e.target.value)} />
          </Field>
          <Field label="Replace with">
            <input value={val2} onChange={(e) => setVal2(e.target.value)} />
          </Field>
        </div>
      )}
      {t === 'text' && (
        <Field label="Operation">
          <select value={txt} onChange={(e) => setTxt(e.target.value as typeof txt)}>
            <option value="trim">Trim</option>
            <option value="upper">UPPERCASE</option>
            <option value="lower">lowercase</option>
            <option value="proper">Capitalize Each Word</option>
            <option value="clean">Remove control characters</option>
          </select>
        </Field>
      )}
      {(t === 'keepRows' || t === 'removeRows') && (
        <div className="grid2">
          <Field label="Rows">
            <input type="number" min={1} value={num} onChange={(e) => setNum(e.target.value)} />
          </Field>
          <Field label="From">
            <select value={from} onChange={(e) => setFrom(e.target.value as 'top' | 'bottom')}>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
        </div>
      )}
      {t === 'group' && (
        <div className="grid2">
          <Field label="Summarize column">
            <select value={aggCol || c0} onChange={(e) => setAggCol(e.target.value)}>
              {cols.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Operation">
            <select value={agg} onChange={(e) => setAgg(e.target.value as Agg)}>
              {(Object.keys(AGG_LABEL) as Agg[]).map((a) => (
                <option key={a} value={a}>
                  {AGG_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {(t === 'append' || t === 'join') && (
        <div className="grid2">
          <Field label="Other table (range like Sheet2!A1:D20, or a saved query)">
            <input list="qsrc" value={src} onChange={(e) => setSrc(e.target.value)} />
          </Field>
          <datalist id="qsrc">
            {others.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          {t === 'join' && (
            <>
              <Field label="Matching column in other table">
                <input value={rcol} onChange={(e) => setRcol(e.target.value)} />
              </Field>
              <Field label="Join kind">
                <select value={jk} onChange={(e) => setJk(e.target.value as 'inner' | 'left')}>
                  <option value="inner">Inner (matches only)</option>
                  <option value="left">Left outer (keep all rows here)</option>
                </select>
              </Field>
            </>
          )}
        </div>
      )}
      <div className="row-btns">
        <button disabled={!step} onClick={() => step && onAdd(step)}>
          Add step
        </button>
      </div>
    </fieldset>
  );
}

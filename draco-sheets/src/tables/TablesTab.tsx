import { useState, type ReactNode } from 'react';
import type { Engine } from '../core/engine';
import { TABLE_STYLES } from '../data/dataTools';
import * as G from './tableGlue';
import { TOTAL_FNS, colName, type TotalFn } from './tableModel';
type Msg = { ok: boolean; message: string } | null;
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label>
    {label}
    {children}
  </label>
);
export default function TablesTab({ engine }: { engine: Engine }) {
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState('');
  const [style, setStyle] = useState(0);
  const [banded, setBanded] = useState(true);
  const [filter, setFilter] = useState(true);
  const [headers, setHeaders] = useState(true);
  const [totals, setTotals] = useState(false);
  const tables = G.listTables();
  const [sel, setSel] = useState<string>('');
  const cur = tables.find((t) => t.id === sel) ?? tables[0] ?? null;
  const [newName, setNewName] = useState('');
  const [ref, setRef] = useState('');
  const [slCol, setSlCol] = useState('');
  const run = (r: { ok: boolean; message: string }) => {
    setMsg(r);
    refresh();
    engine.api.getActiveWorkbook();
  };
  const slicers = G.listSlicers().filter((s) => cur && s.tableId === cur.id);
  return (
    <div>
      <p className="hint">
        Excel-style tables: formulas can use names like <code>Table1[Sales]</code> or <code>[@Sales]</code>, the table
        grows when you type under it, and you can add a total row, styles and slicers.
      </p>
      <h3>Create a table from the selection</h3>
      <div className="grid2">
        <Field label="Table name (blank = automatic)">
          <input
            aria-label="New table name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales"
          />
        </Field>
        <Field label="Style">
          <select aria-label="New table style" value={style} onChange={(e) => setStyle(+e.target.value)}>
            {TABLE_STYLES.map((s, i) => (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row">
        <label className="chk">
          <input
            type="checkbox"
            aria-label="My table has headers"
            checked={headers}
            onChange={(e) => setHeaders(e.target.checked)}
          />
          My table has headers
        </label>
        <label className="chk">
          <input
            type="checkbox"
            aria-label="Banded rows"
            checked={banded}
            onChange={(e) => setBanded(e.target.checked)}
          />
          Banded rows
        </label>
        <label className="chk">
          <input
            type="checkbox"
            aria-label="Filter buttons"
            checked={filter}
            onChange={(e) => setFilter(e.target.checked)}
          />
          Filter buttons
        </label>
        <label className="chk">
          <input
            type="checkbox"
            aria-label="Total row"
            checked={totals}
            onChange={(e) => setTotals(e.target.checked)}
          />
          Total row
        </label>
      </div>
      <div className="row-btns">
        <button
          className="primary"
          onClick={() => {
            const r = G.createTable(engine, {
              name: name.trim() || undefined,
              style,
              banded,
              filter,
              hasHeaders: headers,
              totalRow: totals,
            });
            setMsg(r);
            if (r.ok) {
              setName('');
              if ('table' in r && r.table) setSel(r.table.id);
            }
            refresh();
          }}
        >
          Create table
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? 'hint okmsg' : 'msg'} role={msg.ok ? 'status' : 'alert'}>
          {msg.ok ? '✔ ' : ''}
          {msg.message}
        </p>
      )}
      <h3>Tables in this workbook</h3>
      {!tables.length && <p className="hint">No tables yet.</p>}
      {tables.length > 0 && cur && (
        <>
          <Field label="Table">
            <select
              aria-label="Choose table"
              value={cur.id}
              onChange={(e) => {
                setSel(e.target.value);
                setNewName('');
                setRef('');
              }}
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.sheet}!{colName(t.c0)}
                  {t.r0 + 1}:{colName(t.c1)}
                  {t.r1 + 1}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Rename">
              <input
                aria-label="Rename table"
                value={newName}
                placeholder={cur.name}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
            <Field label="Resize (same header row)">
              <input
                aria-label="Resize table"
                value={ref}
                placeholder={`${colName(cur.c0)}${cur.r0 + 1}:${colName(cur.c1)}${cur.r1 + 1}`}
                onChange={(e) => setRef(e.target.value)}
              />
            </Field>
          </div>
          <div className="row-btns">
            <button
              disabled={!newName.trim()}
              onClick={() => {
                const r = G.renameTable(engine, cur.id, newName.trim());
                run(r);
                if (r.ok) setNewName('');
              }}
            >
              Rename
            </button>
            <button
              disabled={!ref.trim()}
              onClick={() => {
                const r = G.resizeTable(engine, cur.id, ref.trim());
                run(r);
                if (r.ok) setRef('');
              }}
            >
              Resize
            </button>
          </div>
          <div className="grid2">
            <Field label="Style">
              <select
                aria-label="Table style"
                value={cur.style}
                onChange={(e) => run(G.updateTable(engine, cur.id, { style: +e.target.value }))}
              >
                {TABLE_STYLES.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <label className="chk">
              <input
                type="checkbox"
                aria-label="Table banded rows"
                checked={cur.banded}
                onChange={(e) => run(G.updateTable(engine, cur.id, { banded: e.target.checked }))}
              />
              Banded rows
            </label>
            <label className="chk">
              <input
                type="checkbox"
                aria-label="Table filter buttons"
                checked={cur.filter}
                onChange={(e) => run(G.updateTable(engine, cur.id, { filter: e.target.checked }))}
              />
              Filter buttons
            </label>
            <label className="chk">
              <input
                type="checkbox"
                aria-label="Table total row"
                checked={cur.totalRow}
                onChange={(e) => run(G.setTotalRow(engine, cur.id, e.target.checked))}
              />
              Total row
            </label>
          </div>
          {cur.totalRow && (
            <div className="grid2">
              {cur.headers.map((h, i) => (
                <Field key={h} label={`Total — ${h}`}>
                  <select
                    aria-label={`Total for ${h}`}
                    value={cur.totals[i] ?? 'none'}
                    onChange={(e) => run(G.setTotalFn(engine, cur.id, i, e.target.value as TotalFn))}
                  >
                    {TOTAL_FNS.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          )}
          <h3>Slicers</h3>
          <div className="row">
            <Field label="Column">
              <select
                aria-label="Slicer column"
                value={slCol || cur.headers[0]}
                onChange={(e) => setSlCol(e.target.value)}
              >
                {cur.headers.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <button onClick={() => run(G.addTableSlicer(engine, cur.id, slCol || cur.headers[0]))}>Add slicer</button>
          </div>
          <ul className="thread-list">
            {slicers.map((s) => (
              <li className="thread" key={s.id}>
                {s.column}{' '}
                <button aria-label={`Remove slicer ${s.column}`} onClick={() => run(G.removeSlicer(engine, s.id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="row-btns">
            <button className="danger" onClick={() => run(G.convertToRange(engine, cur.id))}>
              Convert to range
            </button>
          </div>
        </>
      )}
    </div>
  );
}

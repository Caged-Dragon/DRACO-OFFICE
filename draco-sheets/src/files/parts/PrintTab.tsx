import { useEffect, useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import type { Out } from '../../data/dataGlue';
import { selectionLoc } from '../../data/dataGlue';
import { a1, orderedSheets } from '../model';
import { buildPrint, download, fullSnapshot, getSetup, pageToSvg, pdfFor, printPages, saveSetup } from '../filesGlue';
import { PAPER_PT, type Paper, type PageSetup } from '../print';
import { Check, Field, FilesCtx, PAPERS, Result, nums } from './shared';

export function PrintTab({ engine, ctx }: { engine: Engine; ctx: FilesCtx }) {
  const snap = useMemo(() => fullSnapshot(engine), [engine]);
  const sheets = useMemo(() => (snap ? orderedSheets(snap) : []), [snap]);
  const active = engine.api.getActiveWorkbook()?.getActiveSheet().getSheetName() ?? sheets[0]?.name ?? '';
  const [sheet, setSheet] = useState(active);
  const sid = sheets.find((s) => s.name === sheet)?.id ?? '';
  const [su, setSu] = useState<PageSetup>(() => getSetup(sid));
  const [page, setPage] = useState(0);
  const [r, setR] = useState<Out | null>(null);
  const [rb, setRb] = useState(() => su.rowBreaks.map((x) => x + 1).join(', '));
  const [cb, setCb] = useState(() => su.colBreaks.map((x) => x + 1).join(', '));
  useEffect(() => {
    const s = getSetup(sid);
    setSu(s);
    setRb(s.rowBreaks.map((x) => x + 1).join(', '));
    setCb(s.colBreaks.map((x) => x + 1).join(', '));
    setPage(0);
  }, [sid]);
  const set = (p: Partial<PageSetup>) => {
    const n = { ...su, ...p };
    setSu(n);
    saveSetup(sid, n);
    ctx.onSetupChanged();
    setPage(0);
  };
  const built = useMemo(() => buildPrint(engine, sheet, ctx.title, su), [engine, sheet, su, ctx.title]);
  const err = 'error' in built ? built.error : null;
  const pages = 'pages' in built ? built.pages : [];
  const warns = 'layout' in built ? built.layout.warnings : [];
  const cur = Math.min(page, Math.max(0, pages.length - 1));
  const M = (k: keyof PageSetup['margins'], l: string) => (
    <Field label={l}>
      <input
        type="number"
        step="0.05"
        min="0"
        max="5"
        aria-label={`Margin ${k}`}
        value={su.margins[k]}
        onChange={(e) => set({ margins: { ...su.margins, [k]: Math.max(0, +e.target.value || 0) } })}
      />
    </Field>
  );
  const HFRow = (kind: 'header' | 'footer', l: string) => (
    <div className="grid3">
      {(['l', 'c', 'r'] as const).map((k) => (
        <Field key={k} label={`${l} ${{ l: 'left', c: 'centre', r: 'right' }[k]}`}>
          <input
            aria-label={`${l} ${k}`}
            value={su[kind][k]}
            placeholder={k === 'c' && kind === 'footer' ? 'Page &P of &N' : ''}
            onChange={(e) => set({ [kind]: { ...su[kind], [k]: e.target.value } } as Partial<PageSetup>)}
          />
        </Field>
      ))}
    </div>
  );
  const useSel = () => {
    const s = selectionLoc(engine);
    if (!s) return;
    set({ printArea: `${a1(s.r0, s.c0)}:${a1(s.r0 + s.rows - 1, s.c0 + s.cols - 1)}` });
  };
  return (
    <div>
      <div className="grid2">
        <Field label="Sheet">
          <select aria-label="Print sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}>
            {sheets.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Paper">
          <select aria-label="Paper size" value={su.paper} onChange={(e) => set({ paper: e.target.value as Paper })}>
            {PAPERS.map(([k, l]) => (
              <option key={k} value={k}>
                {l} ({Math.round((PAPER_PT[k][0] / 72) * 10) / 10}×{Math.round((PAPER_PT[k][1] / 72) * 10) / 10} in)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Orientation">
          <select
            aria-label="Orientation"
            value={su.orientation}
            onChange={(e) => set({ orientation: e.target.value as 'portrait' | 'landscape' })}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </Field>
        <Field label="Page order">
          <select
            aria-label="Page order"
            value={su.pageOrder}
            onChange={(e) => set({ pageOrder: e.target.value as 'down' | 'over' })}
          >
            <option value="down">Down, then over</option>
            <option value="over">Over, then down</option>
          </select>
        </Field>
      </div>
      {err && (
        <p className="msg" role="alert">
          {err}
        </p>
      )}
      {warns.map((w, i) => (
        <p key={i} className="msg" role="status">
          ⚠ {w}
        </p>
      ))}
      {!err && (
        <>
          <div className="actions" role="group" aria-label="Preview pages">
            <button onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0} aria-label="Previous page">
              ◀
            </button>
            <span aria-live="polite" className="pgno">
              Page {cur + 1} of {pages.length}
            </span>
            <button
              onClick={() => setPage(Math.min(pages.length - 1, cur + 1))}
              disabled={cur >= pages.length - 1}
              aria-label="Next page"
            >
              ▶
            </button>
          </div>
          <div
            className="printpreview"
            aria-label="Print preview"
            dangerouslySetInnerHTML={{ __html: pages[cur] ? pageToSvg(pages[cur], { border: true }) : '' }}
          />
          <div className="actions">
            <button className="primary" onClick={() => setR(printPages(pages, ctx.title))}>
              Print…
            </button>
            <button
              onClick={() => {
                download(pdfFor(pages, ctx.title));
                setR({ ok: true, message: `Saved ${pages.length}-page PDF.` });
              }}
            >
              Download PDF
            </button>
          </div>
          <Result r={r} />
        </>
      )}
      <h3>Page setup</h3>
      <fieldset>
        <legend>Scaling</legend>
        <label className="inline">
          <input type="radio" name="scale" checked={!su.useFit} onChange={() => set({ useFit: false })} /> Scale to{' '}
          <input
            type="number"
            min="10"
            max="400"
            aria-label="Scale percent"
            style={{ width: 70 }}
            value={su.scale}
            onChange={(e) => set({ scale: Math.min(400, Math.max(10, +e.target.value || 100)) })}
          />{' '}
          %
        </label>
        <label className="inline">
          <input type="radio" name="scale" checked={su.useFit} onChange={() => set({ useFit: true })} /> Fit to{' '}
          <input
            type="number"
            min="0"
            max="50"
            aria-label="Fit pages wide"
            style={{ width: 56 }}
            value={su.fitW}
            onChange={(e) => set({ fitW: Math.max(0, +e.target.value || 0) })}
          />{' '}
          page(s) wide by{' '}
          <input
            type="number"
            min="0"
            max="50"
            aria-label="Fit pages tall"
            style={{ width: 56 }}
            value={su.fitH}
            onChange={(e) => set({ fitH: Math.max(0, +e.target.value || 0) })}
          />{' '}
          tall <span className="hint">(0 = automatic)</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Margins (inches)</legend>
        <div className="grid3">
          {M('t', 'Top')}
          {M('b', 'Bottom')}
          {M('l', 'Left')}
          {M('r', 'Right')}
          {M('header', 'Header')}
          {M('footer', 'Footer')}
        </div>
      </fieldset>
      <div className="grid2">
        <Field label="Print area (blank = whole sheet)">
          <input
            aria-label="Print area"
            value={su.printArea}
            placeholder="e.g. A1:F40"
            onChange={(e) => set({ printArea: e.target.value.toUpperCase() })}
          />
        </Field>
        <div className="actions" style={{ alignItems: 'end' }}>
          <button onClick={useSel}>Use current selection</button>
          <button onClick={() => set({ printArea: '' })}>Clear</button>
        </div>
        <Field label="Rows to repeat at top">
          <input
            aria-label="Title rows"
            value={su.titleRows}
            placeholder="e.g. 1:2"
            onChange={(e) => set({ titleRows: e.target.value })}
          />
        </Field>
        <Field label="Columns to repeat at left">
          <input
            aria-label="Title columns"
            value={su.titleCols}
            placeholder="e.g. A:B"
            onChange={(e) => set({ titleCols: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Page breaks before rows">
          <input
            aria-label="Row breaks"
            value={rb}
            placeholder="e.g. 21, 41"
            onChange={(e) => {
              setRb(e.target.value);
              set({ rowBreaks: nums(e.target.value) });
            }}
          />
        </Field>
        <Field label="Page breaks before columns (numbers)">
          <input
            aria-label="Column breaks"
            value={cb}
            placeholder="e.g. 5"
            onChange={(e) => {
              setCb(e.target.value);
              set({ colBreaks: nums(e.target.value) });
            }}
          />
        </Field>
      </div>
      <div className="checks">
        <Check label="Gridlines" checked={su.gridlines} onChange={(v) => set({ gridlines: v })} />
        <Check label="Row & column headings" checked={su.headings} onChange={(v) => set({ headings: v })} />
        <Check label="Centre horizontally" checked={su.centerH} onChange={(v) => set({ centerH: v })} />
        <Check label="Centre vertically" checked={su.centerV} onChange={(v) => set({ centerV: v })} />
        <Check label="Black and white" checked={su.blackWhite} onChange={(v) => set({ blackWhite: v })} />
      </div>
      {HFRow('header', 'Header')}
      {HFRow('footer', 'Footer')}
      <p className="hint">
        Codes: &amp;P page number, &amp;N page count, &amp;D date, &amp;T time, &amp;F file name, &amp;A sheet name,
        &amp;&amp; an ampersand.
      </p>
    </div>
  );
}

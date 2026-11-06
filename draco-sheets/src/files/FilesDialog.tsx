import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Dialog from '../Dialog';
import type { Engine } from '../engine';
import type { Out } from '../dataGlue';
import { selectionLoc } from '../dataGlue';
import { a1, orderedSheets, type Snap } from './model';
import { buildPrint, download, exportAs, fullSnapshot, getSetup, importFile, pageToSvg, pasteGrid, pdfFor, printPages, saveSetup, type ExportFormat, type Imported } from './filesGlue';
import { PAPER_PT, type Paper, type PageSetup } from './print';
import { clipToGrid, type ClipGrid } from './clip';
import { addVersion, deleteVersion, getVersion, listVersions, type VersionMeta } from '../store';
import { describeDiff, diffSnapshots, snapHash, type Diff } from './versions';

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => <label className="inline"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
const Result = ({ r }: { r: Out | null }) => (r ? <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>{r.ok ? '✔ ' : ''}{r.message}</p> : null);
type Tab = 'files' | 'print' | 'paste' | 'versions';
export interface FilesCtx { id: string; title: string; getSnapshot: () => Snap | null; onImport: (imp: Imported) => void; onRestore: (snap: Snap, label: string) => void; onSetupChanged: () => void; markCheckpoint?: (hash: string) => void }

export default function FilesDialog({ engine, ctx, tab: first = 'files', onClose }: { engine: Engine; ctx: FilesCtx; tab?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(first);
  return (
    <Dialog title="Files, print & history" onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Files sections">
        {([['files', 'Import / Export'], ['print', 'Print & PDF'], ['paste', 'Paste from Excel / Sheets'], ['versions', 'Version history']] as Array<[Tab, string]>).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'files' && <FilesTab engine={engine} ctx={ctx} onClose={onClose} />}
      {tab === 'print' && <PrintTab engine={engine} ctx={ctx} />}
      {tab === 'paste' && <PasteTab engine={engine} />}
      {tab === 'versions' && <VersionsTab ctx={ctx} onClose={onClose} />}
    </Dialog>
  );
}

function FilesTab({ engine, ctx, onClose }: { engine: Engine; ctx: FilesCtx; onClose: () => void }) {
  const [r, setR] = useState<Out | null>(null); const [warn, setWarn] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [over, setOver] = useState(false);
  const [fmt, setFmt] = useState<ExportFormat>('xlsx'); const [sheet, setSheet] = useState(''); const [display, setDisplay] = useState(true); const [header, setHeader] = useState(true); const [all, setAll] = useState(false); const [bom, setBom] = useState(true);
  const sheets = useMemo(() => { const s = fullSnapshot(engine); return s ? orderedSheets(s).map((x) => x.name) : []; }, [engine]);
  const doImport = async (f: File | undefined) => {
    if (!f) return; setBusy(true); setR(null); setWarn([]);
    try { const imp = await importFile(f); setWarn(imp.warnings); ctx.onImport(imp); setR({ ok: true, message: `Opened "${imp.title}" as a new workbook (${orderedSheets(imp.snap).length} sheet${orderedSheets(imp.snap).length === 1 ? '' : 's'}).` }); if (!imp.warnings.length) setTimeout(onClose, 900); } catch (e) { setR({ ok: false, message: (e as Error).message }); } finally { setBusy(false); }
  };
  const doExport = async () => { setBusy(true); setR(null); try { const ex = await exportAs(engine, fmt, ctx.title, { sheet: sheet || undefined, display, header, allSheets: all, bom }); download(ex); setR({ ok: true, message: `Downloaded ${ex.name}.` }); } catch (e) { setR({ ok: false, message: (e as Error).message }); } finally { setBusy(false); } };
  return (
    <div>
      <h3>Open a file</h3>
      <div className={'dropzone' + (over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void doImport(e.dataTransfer.files[0]); }}>
        <p>Drop a file here, or choose one. Excel (.xlsx, .xlsm), OpenDocument (.ods), CSV / TSV / text, or JSON.</p>
        <input type="file" aria-label="Choose file to import" accept=".xlsx,.xlsm,.xltx,.xltm,.ods,.csv,.tsv,.txt,.json,.xls" onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} disabled={busy} />
        <p className="hint">The file opens as a new workbook; your current workbook is saved first.</p>
      </div>
      {warn.map((w, i) => <p key={i} className="msg" role="status">⚠ {w}</p>)}
      <h3>Download a copy</h3>
      <div className="grid2">
        <Field label="Format"><select aria-label="Export format" value={fmt} onChange={(e) => setFmt(e.target.value as ExportFormat)}><option value="xlsx">Excel workbook (.xlsx)</option><option value="ods">OpenDocument (.ods)</option><option value="csv">CSV (.csv)</option><option value="tsv">Tab separated (.tsv)</option><option value="json">JSON (.json)</option></select></Field>
        {fmt !== 'xlsx' && fmt !== 'ods' && !(fmt === 'json' && all) && <Field label="Sheet"><select aria-label="Export sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}><option value="">Current sheet</option>{sheets.map((s) => <option key={s}>{s}</option>)}</select></Field>}
      </div>
      {(fmt === 'csv' || fmt === 'tsv') && <><Check label="Save values as displayed (dates, currency, % as shown)" checked={display} onChange={setDisplay} />{fmt === 'csv' && <Check label="Add a byte-order mark so Excel reads accents correctly" checked={bom} onChange={setBom} />}</>}
      {fmt === 'json' && <><Check label="First row holds the field names (array of objects)" checked={header} onChange={setHeader} /><Check label="Include every sheet" checked={all} onChange={setAll} /></>}
      <div className="actions"><button className="primary" onClick={() => void doExport()} disabled={busy}>Download</button></div>
      <Result r={r} />
    </div>
  );
}

const PAPERS: Array<[Paper, string]> = [['letter', 'Letter'], ['legal', 'Legal'], ['tabloid', 'Tabloid'], ['a4', 'A4'], ['a3', 'A3'], ['a5', 'A5']];
const nums = (s: string): number[] => s.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => x > 0).map((x) => x - 1);
function PrintTab({ engine, ctx }: { engine: Engine; ctx: FilesCtx }) {
  const snap = useMemo(() => fullSnapshot(engine), [engine]); const sheets = useMemo(() => (snap ? orderedSheets(snap) : []), [snap]);
  const active = engine.api.getActiveWorkbook()?.getActiveSheet().getSheetName() ?? sheets[0]?.name ?? ''; const [sheet, setSheet] = useState(active); const sid = sheets.find((s) => s.name === sheet)?.id ?? '';
  const [su, setSu] = useState<PageSetup>(() => getSetup(sid)); const [page, setPage] = useState(0); const [r, setR] = useState<Out | null>(null); const [rb, setRb] = useState(() => su.rowBreaks.map((x) => x + 1).join(', ')); const [cb, setCb] = useState(() => su.colBreaks.map((x) => x + 1).join(', '));
  useEffect(() => { const s = getSetup(sid); setSu(s); setRb(s.rowBreaks.map((x) => x + 1).join(', ')); setCb(s.colBreaks.map((x) => x + 1).join(', ')); setPage(0); }, [sid]);
  const set = (p: Partial<PageSetup>) => { const n = { ...su, ...p }; setSu(n); saveSetup(sid, n); ctx.onSetupChanged(); setPage(0); };
  const built = useMemo(() => buildPrint(engine, sheet, ctx.title, su), [engine, sheet, su, ctx.title]); const err = 'error' in built ? built.error : null; const pages = 'pages' in built ? built.pages : []; const warns = 'layout' in built ? built.layout.warnings : [];
  const cur = Math.min(page, Math.max(0, pages.length - 1)); const M = (k: keyof PageSetup['margins'], l: string) => <Field label={l}><input type="number" step="0.05" min="0" max="5" aria-label={`Margin ${k}`} value={su.margins[k]} onChange={(e) => set({ margins: { ...su.margins, [k]: Math.max(0, +e.target.value || 0) } })} /></Field>;
  const HFRow = (kind: 'header' | 'footer', l: string) => <div className="grid3">{(['l', 'c', 'r'] as const).map((k) => <Field key={k} label={`${l} ${({ l: 'left', c: 'centre', r: 'right' })[k]}`}><input aria-label={`${l} ${k}`} value={su[kind][k]} placeholder={k === 'c' && kind === 'footer' ? 'Page &P of &N' : ''} onChange={(e) => set({ [kind]: { ...su[kind], [k]: e.target.value } } as Partial<PageSetup>)} /></Field>)}</div>;
  const useSel = () => { const s = selectionLoc(engine); if (!s) return; set({ printArea: `${a1(s.r0, s.c0)}:${a1(s.r0 + s.rows - 1, s.c0 + s.cols - 1)}` }); };
  return (
    <div>
      <div className="grid2">
        <Field label="Sheet"><select aria-label="Print sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}>{sheets.map((s) => <option key={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Paper"><select aria-label="Paper size" value={su.paper} onChange={(e) => set({ paper: e.target.value as Paper })}>{PAPERS.map(([k, l]) => <option key={k} value={k}>{l} ({Math.round(PAPER_PT[k][0] / 72 * 10) / 10}×{Math.round(PAPER_PT[k][1] / 72 * 10) / 10} in)</option>)}</select></Field>
        <Field label="Orientation"><select aria-label="Orientation" value={su.orientation} onChange={(e) => set({ orientation: e.target.value as 'portrait' | 'landscape' })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></Field>
        <Field label="Page order"><select aria-label="Page order" value={su.pageOrder} onChange={(e) => set({ pageOrder: e.target.value as 'down' | 'over' })}><option value="down">Down, then over</option><option value="over">Over, then down</option></select></Field>
      </div>
      {err && <p className="msg" role="alert">{err}</p>}{warns.map((w, i) => <p key={i} className="msg" role="status">⚠ {w}</p>)}
      {!err && <><div className="actions" role="group" aria-label="Preview pages"><button onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0} aria-label="Previous page">◀</button><span aria-live="polite" className="pgno">Page {cur + 1} of {pages.length}</span><button onClick={() => setPage(Math.min(pages.length - 1, cur + 1))} disabled={cur >= pages.length - 1} aria-label="Next page">▶</button></div>
        <div className="printpreview" aria-label="Print preview" dangerouslySetInnerHTML={{ __html: pages[cur] ? pageToSvg(pages[cur], { border: true }) : '' }} />
        <div className="actions"><button className="primary" onClick={() => setR(printPages(pages, ctx.title))}>Print…</button><button onClick={() => { download(pdfFor(pages, ctx.title)); setR({ ok: true, message: `Saved ${pages.length}-page PDF.` }); }}>Download PDF</button></div><Result r={r} /></>}
      <h3>Page setup</h3>
      <fieldset><legend>Scaling</legend>
        <label className="inline"><input type="radio" name="scale" checked={!su.useFit} onChange={() => set({ useFit: false })} /> Scale to <input type="number" min="10" max="400" aria-label="Scale percent" style={{ width: 70 }} value={su.scale} onChange={(e) => set({ scale: Math.min(400, Math.max(10, +e.target.value || 100)) })} /> %</label>
        <label className="inline"><input type="radio" name="scale" checked={su.useFit} onChange={() => set({ useFit: true })} /> Fit to <input type="number" min="0" max="50" aria-label="Fit pages wide" style={{ width: 56 }} value={su.fitW} onChange={(e) => set({ fitW: Math.max(0, +e.target.value || 0) })} /> page(s) wide by <input type="number" min="0" max="50" aria-label="Fit pages tall" style={{ width: 56 }} value={su.fitH} onChange={(e) => set({ fitH: Math.max(0, +e.target.value || 0) })} /> tall <span className="hint">(0 = automatic)</span></label>
      </fieldset>
      <fieldset><legend>Margins (inches)</legend><div className="grid3">{M('t', 'Top')}{M('b', 'Bottom')}{M('l', 'Left')}{M('r', 'Right')}{M('header', 'Header')}{M('footer', 'Footer')}</div></fieldset>
      <div className="grid2">
        <Field label="Print area (blank = whole sheet)"><input aria-label="Print area" value={su.printArea} placeholder="e.g. A1:F40" onChange={(e) => set({ printArea: e.target.value.toUpperCase() })} /></Field>
        <div className="actions" style={{ alignItems: 'end' }}><button onClick={useSel}>Use current selection</button><button onClick={() => set({ printArea: '' })}>Clear</button></div>
        <Field label="Rows to repeat at top"><input aria-label="Title rows" value={su.titleRows} placeholder="e.g. 1:2" onChange={(e) => set({ titleRows: e.target.value })} /></Field>
        <Field label="Columns to repeat at left"><input aria-label="Title columns" value={su.titleCols} placeholder="e.g. A:B" onChange={(e) => set({ titleCols: e.target.value.toUpperCase() })} /></Field>
        <Field label="Page breaks before rows"><input aria-label="Row breaks" value={rb} placeholder="e.g. 21, 41" onChange={(e) => { setRb(e.target.value); set({ rowBreaks: nums(e.target.value) }); }} /></Field>
        <Field label="Page breaks before columns (numbers)"><input aria-label="Column breaks" value={cb} placeholder="e.g. 5" onChange={(e) => { setCb(e.target.value); set({ colBreaks: nums(e.target.value) }); }} /></Field>
      </div>
      <div className="checks"><Check label="Gridlines" checked={su.gridlines} onChange={(v) => set({ gridlines: v })} /><Check label="Row & column headings" checked={su.headings} onChange={(v) => set({ headings: v })} /><Check label="Centre horizontally" checked={su.centerH} onChange={(v) => set({ centerH: v })} /><Check label="Centre vertically" checked={su.centerV} onChange={(v) => set({ centerV: v })} /><Check label="Black and white" checked={su.blackWhite} onChange={(v) => set({ blackWhite: v })} /></div>
      {HFRow('header', 'Header')}{HFRow('footer', 'Footer')}
      <p className="hint">Codes: &amp;P page number, &amp;N page count, &amp;D date, &amp;T time, &amp;F file name, &amp;A sheet name, &amp;&amp; an ampersand.</p>
    </div>
  );
}

function PasteTab({ engine }: { engine: Engine }) {
  const [grid, setGrid] = useState<ClipGrid | null>(null); const [r, setR] = useState<Out | null>(null); const [at, setAt] = useState('');
  const take = (html: string | undefined, text: string | undefined) => { const g = clipToGrid(html, text); setGrid(g); setR(g ? null : { ok: false, message: 'Nothing usable on the clipboard. Copy some cells in Excel or Google Sheets first.' }); };
  const sel = selectionLoc(engine); const target = at.trim() ? at.trim().toUpperCase() : sel ? a1(sel.r0, sel.c0) : 'A1';
  const readClip = async () => { try { const items = await navigator.clipboard.read(); let html = '', text = ''; for (const it of items) { if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text(); if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text(); } take(html, text); } catch { setR({ ok: false, message: 'The browser blocked clipboard access. Click the box below and press Ctrl+V (⌘V) instead.' }); } };
  const insert = () => { if (!grid) return; const m = /^([A-Z]+)(\d+)$/.exec(target); if (!m) return setR({ ok: false, message: `"${target}" isn't a valid cell.` }); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; setR(pasteGrid(engine, grid, { r: +m[2] - 1, c: c - 1 })); };
  return (
    <div>
      <p>Copy cells in Excel, Google Sheets or a web page, then paste them here to keep their fonts, colours, borders, merged cells and number formats.</p>
      <div className="actions"><button onClick={() => void readClip()}>Read clipboard</button></div>
      <div className="pastebox" contentEditable suppressContentEditableWarning role="textbox" aria-label="Paste area" tabIndex={0} onPaste={(e) => { e.preventDefault(); take(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain')); }} onKeyDown={(e) => { if (!(e.ctrlKey || e.metaKey) && e.key.length === 1) e.preventDefault(); }}>{grid ? '' : 'Click here and press Ctrl+V'}</div>
      {grid && <><p className="hint">Found {grid.rows} × {grid.cols} cells from {grid.source === 'excel' ? 'Excel' : grid.source === 'sheets' ? 'Google Sheets' : grid.source === 'html' ? 'a web table' : 'plain text'}{grid.merges.length ? `, ${grid.merges.length} merged` : ''}.</p>
        <div className="qprev"><table><tbody>{grid.cells.slice(0, 8).map((row, i) => <tr key={i}>{row.slice(0, 8).map((c, j) => <td key={j} style={{ fontWeight: c?.style.bl ? 700 : 400, fontStyle: c?.style.it ? 'italic' : 'normal', color: c?.style.cl?.rgb, background: c?.style.bg?.rgb, textAlign: c?.style.ht === 3 ? 'right' : c?.style.ht === 2 ? 'center' : undefined }}>{c?.text ?? ''}</td>)}</tr>)}</tbody></table></div>
        <div className="grid2"><Field label="Paste at cell"><input aria-label="Paste at cell" value={at} placeholder={target} onChange={(e) => setAt(e.target.value)} /></Field><div className="actions" style={{ alignItems: 'end' }}><button className="primary" onClick={insert}>Insert at {target}</button></div></div></>}
      <Result r={r} />
    </div>
  );
}

function VersionsTab({ ctx, onClose }: { ctx: FilesCtx; onClose: () => void }) {
  const [list, setList] = useState<VersionMeta[]>([]); const [label, setLabel] = useState(''); const [r, setR] = useState<Out | null>(null); const [diff, setDiff] = useState<{ title: string; d: Diff } | null>(null); const [busy, setBusy] = useState(false); const cur = useRef(ctx);
  const reload = async () => setList(await listVersions(cur.current.id).catch(() => []));
  useEffect(() => { void reload(); }, []);
  const save = async () => { const s = ctx.getSnapshot(); if (!s) return; setBusy(true); try { const h = snapHash(s); await addVersion(ctx.id, s as never, label.trim() || 'Saved version', 'manual', h); ctx.markCheckpoint?.(h); setLabel(''); setR({ ok: true, message: 'Version saved.' }); await reload(); } catch (e) { setR({ ok: false, message: `Couldn't save: ${(e as Error).message}` }); } setBusy(false); };
  const compare = async (v: VersionMeta) => { const row = await getVersion(v.key); const now = ctx.getSnapshot(); if (!row || !now) return; setDiff({ title: `${v.label} → now`, d: diffSnapshots(row.data as unknown as Snap, now) }); };
  const restore = async (v: VersionMeta) => { const row = await getVersion(v.key); if (!row) return; if (!confirm(`Restore "${v.label}" from ${new Date(v.at).toLocaleString()}?\n\nThe current state is kept in the history, so you can come back to it.`)) return; const now = ctx.getSnapshot(); if (now) await addVersion(ctx.id, now as never, 'Before restoring "' + v.label + '"', 'manual', snapHash(now)); ctx.onRestore(row.data as unknown as Snap, v.label); onClose(); };
  const remove = async (v: VersionMeta) => { await deleteVersion(v.key); await reload(); };
  return (
    <div>
      <div className="grid2"><Field label="Name this version (optional)"><input aria-label="Version name" value={label} placeholder="e.g. Before budget changes" onChange={(e) => setLabel(e.target.value)} /></Field><div className="actions" style={{ alignItems: 'end' }}><button className="primary" onClick={() => void save()} disabled={busy}>Save version now</button></div></div>
      <p className="hint">Draco also keeps an automatic checkpoint every few minutes while you edit (the latest 30 are kept). Named versions are never removed automatically.</p>
      <Result r={r} />
      {list.length === 0 ? <p>No versions yet.</p> : <ul className="versions" aria-label="Versions">{list.map((v) => <li key={v.key}><span><b>{v.label}</b> <small>{new Date(v.at).toLocaleString()} · {v.kind === 'manual' ? 'saved' : 'auto'}</small></span><span><button onClick={() => void compare(v)}>Compare with now</button><button onClick={() => void restore(v)}>Restore</button><button onClick={() => void remove(v)} aria-label={`Delete version ${v.label}`}>✕</button></span></li>)}</ul>}
      {diff && <div aria-label="Differences"><h3>{diff.title}</h3><p className="hint">{describeDiff(diff.d)}</p>
        {diff.d.sheetsAdded.length > 0 && <p>Sheets added: {diff.d.sheetsAdded.join(', ')}</p>}{diff.d.sheetsRemoved.length > 0 && <p>Sheets removed: {diff.d.sheetsRemoved.join(', ')}</p>}{diff.d.sheetsRenamed.length > 0 && <p>Renamed: {diff.d.sheetsRenamed.map((x) => `${x.from} → ${x.to}`).join(', ')}</p>}
        {diff.d.changes.length > 0 && <div className="qprev"><table><thead><tr><th>Cell</th><th>Change</th><th>Then</th><th>Now</th></tr></thead><tbody>{diff.d.changes.slice(0, 200).map((c, i) => <tr key={i}><td>{c.sheet}!{c.addr}</td><td>{c.kind}</td><td>{c.before}</td><td>{c.after}</td></tr>)}</tbody></table></div>}</div>}
    </div>
  );
}

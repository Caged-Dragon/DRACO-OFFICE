import { useMemo, useState } from 'react';
import type { Engine } from '../../core/engine';
import type { Out } from '../../data/dataGlue';
import { orderedSheets } from '../model';
import { download, exportAs, fullSnapshot, importFile, type ExportFormat } from '../filesGlue';
import { Check, Field, FilesCtx, Result, Tab } from './shared';

export function FilesTab({ engine, ctx, onClose }: { engine: Engine; ctx: FilesCtx; onClose: () => void }) {
  const [r, setR] = useState<Out | null>(null);
  const [warn, setWarn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [fmt, setFmt] = useState<ExportFormat>('xlsx');
  const [sheet, setSheet] = useState('');
  const [display, setDisplay] = useState(true);
  const [header, setHeader] = useState(true);
  const [all, setAll] = useState(false);
  const [bom, setBom] = useState(true);
  const sheets = useMemo(() => {
    const s = fullSnapshot(engine);
    return s ? orderedSheets(s).map((x) => x.name) : [];
  }, [engine]);
  const doImport = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setR(null);
    setWarn([]);
    try {
      const imp = await importFile(f);
      setWarn(imp.warnings);
      ctx.onImport(imp);
      setR({
        ok: true,
        message: `Opened "${imp.title}" as a new workbook (${orderedSheets(imp.snap).length} sheet${orderedSheets(imp.snap).length === 1 ? '' : 's'}).`,
      });
      if (!imp.warnings.length) setTimeout(onClose, 900);
    } catch (e) {
      setR({ ok: false, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const doExport = async () => {
    setBusy(true);
    setR(null);
    try {
      const ex = await exportAs(engine, fmt, ctx.title, {
        sheet: sheet || undefined,
        display,
        header,
        allSheets: all,
        bom,
      });
      download(ex);
      setR({ ok: true, message: `Downloaded ${ex.name}.` });
    } catch (e) {
      setR({ ok: false, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <h3>Open a file</h3>
      <div
        className={'dropzone' + (over ? ' over' : '')}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void doImport(e.dataTransfer.files[0]);
        }}
      >
        <p>Drop a file here, or choose one. Excel (.xlsx, .xlsm), OpenDocument (.ods), CSV / TSV / text, or JSON.</p>
        <input
          type="file"
          aria-label="Choose file to import"
          accept=".xlsx,.xlsm,.xltx,.xltm,.ods,.csv,.tsv,.txt,.json,.xls"
          onChange={(e) => {
            void doImport(e.target.files?.[0]);
            e.target.value = '';
          }}
          disabled={busy}
        />
        <p className="hint">The file opens as a new workbook; your current workbook is saved first.</p>
      </div>
      {warn.map((w, i) => (
        <p key={i} className="msg" role="status">
          ⚠ {w}
        </p>
      ))}
      <h3>Download a copy</h3>
      <div className="grid2">
        <Field label="Format">
          <select aria-label="Export format" value={fmt} onChange={(e) => setFmt(e.target.value as ExportFormat)}>
            <option value="xlsx">Excel workbook (.xlsx)</option>
            <option value="ods">OpenDocument (.ods)</option>
            <option value="csv">CSV (.csv)</option>
            <option value="tsv">Tab separated (.tsv)</option>
            <option value="json">JSON (.json)</option>
          </select>
        </Field>
        {fmt !== 'xlsx' && fmt !== 'ods' && !(fmt === 'json' && all) && (
          <Field label="Sheet">
            <select aria-label="Export sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}>
              <option value="">Current sheet</option>
              {sheets.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {(fmt === 'csv' || fmt === 'tsv') && (
        <>
          <Check
            label="Save values as displayed (dates, currency, % as shown)"
            checked={display}
            onChange={setDisplay}
          />
          {fmt === 'csv' && (
            <Check label="Add a byte-order mark so Excel reads accents correctly" checked={bom} onChange={setBom} />
          )}
        </>
      )}
      {fmt === 'json' && (
        <>
          <Check label="First row holds the field names (array of objects)" checked={header} onChange={setHeader} />
          <Check label="Include every sheet" checked={all} onChange={setAll} />
        </>
      )}
      <div className="actions">
        <button className="primary" onClick={() => void doExport()} disabled={busy}>
          Download
        </button>
      </div>
      <Result r={r} />
    </div>
  );
}

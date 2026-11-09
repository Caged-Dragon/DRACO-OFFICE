import { useState } from 'react';
import type { Engine } from '../../core/engine';
import type { Out } from '../../data/dataGlue';
import { selectionLoc } from '../../data/dataGlue';
import { a1 } from '../model';
import { pasteGrid } from '../filesGlue';
import { clipToGrid, type ClipGrid } from '../clip';
import { Field, Result } from './shared';

export function PasteTab({ engine }: { engine: Engine }) {
  const [grid, setGrid] = useState<ClipGrid | null>(null);
  const [r, setR] = useState<Out | null>(null);
  const [at, setAt] = useState('');
  const take = (html: string | undefined, text: string | undefined) => {
    const g = clipToGrid(html, text);
    setGrid(g);
    setR(
      g
        ? null
        : { ok: false, message: 'Nothing usable on the clipboard. Copy some cells in Excel or Google Sheets first.' },
    );
  };
  const sel = selectionLoc(engine);
  const target = at.trim() ? at.trim().toUpperCase() : sel ? a1(sel.r0, sel.c0) : 'A1';
  const readClip = async () => {
    try {
      const items = await navigator.clipboard.read();
      let html = '',
        text = '';
      for (const it of items) {
        if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
        if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
      }
      take(html, text);
    } catch {
      setR({
        ok: false,
        message: 'The browser blocked clipboard access. Click the box below and press Ctrl+V (⌘V) instead.',
      });
    }
  };
  const insert = () => {
    if (!grid) return;
    const m = /^([A-Z]+)(\d+)$/.exec(target);
    if (!m) return setR({ ok: false, message: `"${target}" isn't a valid cell.` });
    let c = 0;
    for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
    setR(pasteGrid(engine, grid, { r: +m[2] - 1, c: c - 1 }));
  };
  return (
    <div>
      <p>
        Copy cells in Excel, Google Sheets or a web page, then paste them here to keep their fonts, colours, borders,
        merged cells and number formats.
      </p>
      <div className="actions">
        <button onClick={() => void readClip()}>Read clipboard</button>
      </div>
      <div
        className="pastebox"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Paste area"
        tabIndex={0}
        onPaste={(e) => {
          e.preventDefault();
          take(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'));
        }}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey) && e.key.length === 1) e.preventDefault();
        }}
      >
        {grid ? '' : 'Click here and press Ctrl+V'}
      </div>
      {grid && (
        <>
          <p className="hint">
            Found {grid.rows} × {grid.cols} cells from{' '}
            {grid.source === 'excel'
              ? 'Excel'
              : grid.source === 'sheets'
                ? 'Google Sheets'
                : grid.source === 'html'
                  ? 'a web table'
                  : 'plain text'}
            {grid.merges.length ? `, ${grid.merges.length} merged` : ''}.
          </p>
          <div className="qprev">
            <table>
              <tbody>
                {grid.cells.slice(0, 8).map((row, i) => (
                  <tr key={i}>
                    {row.slice(0, 8).map((c, j) => (
                      <td
                        key={j}
                        style={{
                          fontWeight: c?.style.bl ? 700 : 400,
                          fontStyle: c?.style.it ? 'italic' : 'normal',
                          color: c?.style.cl?.rgb,
                          background: c?.style.bg?.rgb,
                          textAlign: c?.style.ht === 3 ? 'right' : c?.style.ht === 2 ? 'center' : undefined,
                        }}
                      >
                        {c?.text ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid2">
            <Field label="Paste at cell">
              <input
                aria-label="Paste at cell"
                value={at}
                placeholder={target}
                onChange={(e) => setAt(e.target.value)}
              />
            </Field>
            <div className="actions" style={{ alignItems: 'end' }}>
              <button className="primary" onClick={insert}>
                Insert at {target}
              </button>
            </div>
          </div>
        </>
      )}
      <Result r={r} />
    </div>
  );
}

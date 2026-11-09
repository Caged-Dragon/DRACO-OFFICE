import { useEffect, useState } from 'react';
import * as G from '../collabGlue';
import { Out, Result, addr, saveText } from './shared';

export function NotesTab() {
  const [text, setText] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const cell = G.selectionCell();
  const notes = G.listNotes();
  useEffect(() => {
    const n = cell ? notes.find((x) => x.sheetId === cell.sheetId && x.r === cell.r && x.c === cell.c) : null;
    setText(n?.text ?? '');
  }, [cell?.sheetId, cell?.r, cell?.c]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <h3>Note {cell ? `on ${addr(cell.r, cell.c)}` : ''}</h3>
      <p className="hint">A note is a plain sticky note on a cell (no replies). Use comments for conversations.</p>
      <textarea aria-label="Note text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="primary" onClick={() => setR(G.setNote(text))}>
          {text.trim() ? 'Save note' : 'Delete note'}
        </button>
      </div>
      <Result r={r} />
      <h3>All notes ({notes.length})</h3>
      <div className="row">
        <button onClick={() => saveText('notes.csv', G.notesCsv())}>Export CSV</button>
      </div>
      <ul className="thread-list">
        {notes.map((n) => (
          <li className="thread" key={n.id}>
            <button className="link" onClick={() => G.goToCell(n.sheetId, n.r, n.c)}>
              {n.sheet}!{addr(n.r, n.c)}
            </button>
            <p className="thread-text">{n.text}</p>
            <button onClick={() => setR(G.deleteNote(n))}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useState, useSyncExternalStore } from 'react';
import type { Engine } from '../engine';
import * as G from './a11yGlue';
import { issueSummary, SHORTCUT_HINTS, type Issue } from './a11y';
import { goToCell } from '../links/linksGlue';

export default function AccessTab({ engine }: { engine: Engine }) {
  useSyncExternalStore(G.subscribe, G.version); const s = G.get(); const [issues, setIssues] = useState<Issue[] | null>(null);
  const sum = issues ? issueSummary(issues) : null;
  return (
    <div>
      <h3>Display</h3>
      <div className="grid2">
        <label className="inline"><input type="checkbox" checked={s.highContrast} onChange={(e) => G.set({ highContrast: e.target.checked })} /> High contrast</label>
        <label className="inline"><input type="checkbox" checked={s.reduceMotion} onChange={(e) => G.set({ reduceMotion: e.target.checked })} /> Reduce motion</label>
        <label className="inline"><input type="checkbox" checked={s.strongFocus} onChange={(e) => G.set({ strongFocus: e.target.checked })} /> Strong focus outline</label>
        <label>Text size <select aria-label="Text size" value={s.textScale} onChange={(e) => G.set({ textScale: +e.target.value as never })}><option value={100}>Normal</option><option value={115}>Large</option><option value={130}>Larger</option><option value={150}>Largest</option></select></label>
      </div>
      <h3>Screen reader</h3>
      <label className="inline"><input type="checkbox" checked={s.announce} onChange={(e) => G.set({ announce: e.target.checked })} /> Read out the selected cell (address, value, headings, formula)</label>
      <p className="hint">Works with NVDA, JAWS, VoiceOver and TalkBack through a live region. The spreadsheet grid itself is drawn on a canvas, so this is how its contents reach your screen reader.</p>
      <h3>Accessibility checker</h3>
      <div className="row"><button className="primary" onClick={() => setIssues(G.runChecker(engine))}>Check workbook</button>{sum && <span role="status">{sum.error} error{sum.error === 1 ? '' : 's'}, {sum.warning} warning{sum.warning === 1 ? '' : 's'}, {sum.tip} tip{sum.tip === 1 ? '' : 's'}</span>}</div>
      {issues && !issues.length && <p className="hint okmsg" role="status">✔ No problems found.</p>}
      <ul className="thread-list">{(issues ?? []).slice(0, 100).map((i) => <li className="thread" key={i.id} data-issue={i.kind}><div className="thread-head"><b className={i.severity === 'error' ? 'msg' : ''}>{i.severity}</b><span>{i.message}</span>{i.a1 && <button className="link" onClick={() => goToCell(engine, i.sheetId, i.r ?? 0, i.c ?? 0)}>{i.sheet}!{i.a1}</button>}</div><p className="hint">{i.fix}</p></li>)}</ul>
      <h3>Keyboard</h3>
      <table className="chg"><tbody>{SHORTCUT_HINTS.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
    </div>
  );
}

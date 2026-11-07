import { PageHead } from '../components/PageHead';

export default function Shortcuts() {
  const S: Array<[string, string]> = [['Ctrl + C / X / V', 'Copy, cut, paste'], ['Ctrl + Z / Y', 'Undo, redo'], ['Ctrl + F / H', 'Find, replace'], ['Ctrl + K', 'Command search'], ['Ctrl + B / I / U', 'Bold, italic, underline'], ['Ctrl + ;', 'Insert today’s date'], ['Ctrl + Arrow', 'Jump to the edge of data'], ['Ctrl + Shift + Arrow', 'Select to the edge of data'], ['Ctrl + A', 'Select all'], ['F2', 'Edit the active cell'], ['F4', 'Toggle absolute and relative references'], ['Alt + =', 'AutoSum'], ['Ctrl + Enter', 'Fill the selection with the entry'], ['Shift + Space / Ctrl + Space', 'Select row, select column']];
  return (<><PageHead t="Keyboard shortcuts" d="The usual spreadsheet keys work here." /><section className="s-sec"><div className="s-wrap s-narrow"><table className="s-keys"><tbody>{S.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table><p className="s-muted">On a Mac, use Cmd in place of Ctrl.</p></div></section></>);
}



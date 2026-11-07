import { A } from '../components/Link';
import { FEATS } from './featuresData';

export default function Home() {
  const rows = [['Item', 'Units', 'Price', 'Total'], ['Widgets', '12', '4.50', '54.00'], ['Gadgets', '7', '9.25', '64.75'], ['Gizmos', '20', '2.10', '42.00'], ['Total', '39', '', '160.75']];
  return (<>
    <section className="s-hero"><div className="s-wrap s-hero-in">
      <div><p className="s-eyebrow">Spreadsheets, rebuilt for the web</p>
        <h1>The spreadsheet that opens in a tab and works like the one you know.</h1>
        <p className="s-lead">Formulas, charts, pivot tables, Excel-style tables, data validation and real .xlsx import and export — with no install and nothing to sign up for.</p>
        <div className="s-cta"><A to="/app?new=1" className="s-btn s-btn-go s-lg">Start a blank workbook</A><A to="/templates" className="s-btn s-lg">Browse templates</A></div><div className="s-hero-co"><img src="/company-128.png" alt="" width="40" height="40" /><span>By Caged Dragon Studios</span></div></div>
      <div className="s-mock" aria-hidden="true"><img className="s-dragon" src="/logo-256.png" alt="" width="84" height="84" /><div className="s-mock-bar"><i /><i /><i /><span>Q4 sales.xlsx</span></div>
        <table><tbody>{rows.map((r, i) => <tr key={i} className={i === 0 ? 'h' : i === rows.length - 1 ? 't' : ''}><th>{i + 1}</th>{r.map((c, j) => <td key={j} className={j > 0 ? 'n' : ''}>{c}</td>)}</tr>)}</tbody></table>
        <div className="s-bars">{[40, 62, 48, 80, 66].map((h, i) => <b key={i} style={{ height: h }} />)}</div></div>
    </div></section>
    <section className="s-sec"><div className="s-wrap"><h2>Everything in one place</h2>
      <div className="s-grid3">{FEATS.slice(0, 6).map((f) => <article key={f.t} className="s-card"><div className="s-ic">{f.i}</div><h3>{f.t}</h3><p>{f.d}</p></article>)}</div>
      <p className="s-more"><A to="/features">See every feature →</A></p></div></section>
    <section className="s-sec s-alt"><div className="s-wrap s-split">
      <div><h2>Bring your Excel files</h2><p>Open an .xlsx and keep your formatting, formulas, merged cells and tables. Save back to .xlsx with real Excel tables and native charts, so the file keeps working in Excel.</p><A to="/home" className="s-btn s-btn-go">Try it with a file</A></div>
      <ul className="s-ticks"><li>Reads and writes .xlsx, .csv and .ods</li><li>Excel tables survive the round trip</li><li>Column, bar, line, area, pie and scatter charts export as native Excel charts</li><li>Share by link, view-only or editable</li></ul></div></section>
    <section className="s-sec"><div className="s-wrap s-cta-band"><h2>Ready when you are</h2><A to="/home" className="s-btn s-btn-go s-lg">Open Draco Sheets</A></div></section>
  </>);
}


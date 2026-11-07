import { A, go } from '../components/Link';
import { PageHead } from '../components/PageHead';
import { TEMPLATES } from '../../gallery/templates';

export default function Templates() {
  const cats = ['Personal', 'Business', 'School', 'Planning'] as const;
  return (<><PageHead t="Templates" d="Pick a template and it opens in the editor, ready to edit." />
    <section className="s-sec"><div className="s-wrap">{cats.map((c) => { const l = TEMPLATES.filter((t) => t.category === c); return l.length ? <div key={c}><h2 className="s-h2">{c}</h2><div className="s-grid3">{l.map((t) => <a key={t.id} href={`/app?template=${t.id}`} className="s-card link" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); go(`/app?template=${encodeURIComponent(t.id)}`); }}><h3>{t.title}</h3><p>{t.blurb}</p><small>{t.sheets.length} sheet{t.sheets.length === 1 ? '' : 's'}</small><span className="use">Use this template →</span></a>)}</div></div> : null; })}
      <p className="s-more"><A to="/home" className="s-btn s-btn-go">Open the app</A></p></div></section></>);
}


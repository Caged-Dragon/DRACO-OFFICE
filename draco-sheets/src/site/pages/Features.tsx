import { PageHead } from '../components/PageHead';
import { FEATS } from './featuresData';

export default function Features() {
  return (
    <>
      <PageHead t="Features" d="What you can do in Draco Sheets today." />
      <section className="s-sec">
        <div className="s-wrap s-grid3">
          {FEATS.map((f) => (
            <article key={f.t} className="s-card">
              <div className="s-ic">{f.i}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </article>
          ))}
        </div>
        <div className="s-wrap">
          <div className="s-note">
            <h3>What it does not do yet</h3>
            <p>
              Manual and iterative calculation, outline grouping, right-to-left grids, native Excel pivot tables on
              export and reading charts back from .xlsx are not available.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

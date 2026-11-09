/** Title band at the top of every content page. */
export function PageHead({ t, d }: { t: string; d: string }) {
  return (
    <section className="s-phead">
      <div className="s-wrap">
        <h1>{t}</h1>
        <p className="s-lead">{d}</p>
      </div>
    </section>
  );
}

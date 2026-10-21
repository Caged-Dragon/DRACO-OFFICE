import Dialog from './Dialog';
import versions from './versions.json';

type V = { v: number; title: string; phase: string; status: 'done' | 'planned' };

export default function RoadmapDialog({ onClose }: { onClose: () => void }) {
  const list = versions as V[];
  const done = list.filter((x) => x.status === 'done').length;
  const phases = [...new Set(list.map((x) => x.phase))];
  return (
    <Dialog title={`Roadmap — ${done}/100 versions shipped`} onClose={onClose} wide>
      <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${done}%` }} /></div>
      {phases.map((p) => (
        <section key={p}>
          <h3>Phase {p}</h3>
          <ul className="roadmap">
            {list.filter((x) => x.phase === p).map((x) => (
              <li key={x.v} className={x.status}>
                <span className="tick">{x.status === 'done' ? '✔' : '○'}</span>
                <b>v{x.v}</b> {x.title}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}

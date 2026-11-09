import type { CSSProperties } from 'react';
import type { Group, Item } from './types';
import { RibbonButton } from './RibbonButton';

/** Rows for a plain icon grid. */
export const rowsFor = (g: Group): number =>
  g.rows ?? (g.items.length <= 3 ? 1 : g.items.length <= 6 ? 2 : g.items.length <= 9 ? 3 : 4);

/** A labelled cluster of controls inside a tab panel: large captioned buttons, stacked lines (Excel style) or a compact icon grid. */
export function RibbonGroup({ group, onRun }: { group: Group; onRun: (i: Item) => void }) {
  const run = (it: Item, big?: boolean) => <RibbonButton key={it.l} item={it} onRun={onRun} big={big} />;
  let body;
  if (group.big) body = <div className="rb-bigs">{group.items.map((it) => run(it, true))}</div>;
  else if (group.lines)
    body = (
      <div className="rb-lines">
        {group.lines.map((ln, k) => (
          <div className="rb-line" key={k}>
            {ln.map((it) => run(it))}
          </div>
        ))}
      </div>
    );
  else
    body = (
      <div className="rb-items grid" style={{ '--rows': rowsFor(group) } as CSSProperties}>
        {group.items.map((it) => run(it))}
      </div>
    );
  return (
    <div className="rb-group" role="group" aria-label={group.n}>
      {body}
      <div className="rb-gn">{group.n}</div>
    </div>
  );
}

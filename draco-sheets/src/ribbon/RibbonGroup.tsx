import type { Group, Item } from './types';
import { RibbonButton } from './RibbonButton';
/** A labelled cluster of buttons inside a tab panel. */
export function RibbonGroup({ group, onRun }: { group: Group; onRun: (i: Item) => void }) {
  return <div className="rb-group" role="group" aria-label={group.n}><div className="rb-items">{group.items.map((it) => <RibbonButton key={it.l} item={it} onRun={onRun} />)}</div><div className="rb-gn">{group.n}</div></div>;
}

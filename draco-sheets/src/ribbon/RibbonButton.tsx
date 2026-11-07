import type { Item } from './types';
/** One ribbon button: glyph + label. Large by default, compact with size "s". */
export function RibbonButton({ item, onRun }: { item: Item; onRun: (i: Item) => void }) {
  return <button type="button" className={'rb-btn' + (item.size === 's' ? ' s' : '')} title={item.l} onClick={() => onRun(item)}><span className="rb-ic" aria-hidden>{item.i}</span><span className="rb-lb">{item.l}</span></button>;
}

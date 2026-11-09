import { useRef, useState } from 'react';
import type { Item, MenuEntry } from './types';
import { RibbonMenu } from './RibbonMenu';

const act = (x: { c?: string; run?: () => void }, onRun: (i: Item) => void) => onRun(x as Item);

/** One ribbon control: icon button, split button (action + caret) or text drop-down (Font, Size, Number format). */
export function RibbonButton({ item, onRun, big }: { item: Item; onRun: (i: Item) => void; big?: boolean }) {
  const [open, setOpen] = useState<DOMRect | null>(null);
  const [last, setLast] = useState(item.def ?? 0);
  const anchor = useRef<HTMLDivElement>(null);
  const pick = (e: MenuEntry, idx: number) => {
    setOpen(null);
    if (!item.c && !item.run && !item.text) setLast(idx);
    act(e, onRun);
  };
  const show = () => setOpen(anchor.current?.getBoundingClientRect() ?? null);
  const picked = item.menu?.[last];
  const main = () => {
    if (item.c || item.run) act(item, onRun);
    else if (picked) act(picked, onRun);
  };
  const tone = item.color ?? (!item.c && !item.run ? picked?.color : undefined);
  const menu = open && item.menu && (
    <RibbonMenu
      anchor={open}
      entries={item.menu}
      grid={item.grid}
      label={item.l}
      onClose={() => setOpen(null)}
      onPick={(e) => pick(e, item.menu!.indexOf(e))}
    />
  );
  if (item.text) {
    return (
      <div className="rb-ctl" ref={anchor}>
        <button
          type="button"
          className="rb-text"
          title={item.l}
          aria-label={item.l}
          aria-haspopup="menu"
          aria-expanded={!!open}
          onClick={() => (open ? setOpen(null) : show())}
        >
          <span>{item.text}</span>
          <span className="rb-caret" aria-hidden>
            ▾
          </span>
        </button>
        {menu}
      </div>
    );
  }
  const cap = big ? <span className="rb-cap">{item.l}</span> : null;
  const icon = (
    <span className="rb-ic" style={{ color: item.color, fontFamily: item.font }} aria-hidden>
      {item.i}
    </span>
  );
  if (!item.menu)
    return (
      <button
        type="button"
        className={'rb-btn' + (big ? ' big' : '')}
        title={item.l}
        aria-label={item.l}
        onClick={() => act(item, onRun)}
      >
        {icon}
        {cap}
      </button>
    );
  return (
    <div className={'rb-split' + (big ? ' big' : '')} ref={anchor}>
      <button
        type="button"
        className={'rb-btn rb-main' + (big ? ' big' : '')}
        title={item.l}
        aria-label={item.l}
        onClick={main}
      >
        <span className="rb-ic" style={{ fontFamily: item.font }} aria-hidden>
          {item.i}
        </span>
        {item.grid && <span className="rb-bar" style={{ background: tone ?? 'transparent' }} aria-hidden />}
        {big && <span className="rb-cap">{item.l}</span>}
      </button>
      <button
        type="button"
        className="rb-arrow"
        title={`${item.l} options`}
        aria-label={`${item.l} options`}
        aria-haspopup="menu"
        aria-expanded={!!open}
        onClick={() => (open ? setOpen(null) : show())}
      >
        ▾
      </button>
      {menu}
    </div>
  );
}

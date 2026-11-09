import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MenuEntry } from './types';

/** The pop-up list or swatch grid under a ribbon drop-down. Closes on outside click, Escape, scroll or resize. */
export function RibbonMenu({
  anchor,
  entries,
  grid,
  label,
  onPick,
  onClose,
}: {
  anchor: DOMRect;
  entries: MenuEntry[];
  grid?: boolean;
  label: string;
  onPick: (e: MenuEntry) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 2 });
  useLayoutEffect(() => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      left: Math.max(4, Math.min(anchor.left, innerWidth - r.width - 6)),
      top: anchor.bottom + r.height + 8 > innerHeight ? Math.max(4, anchor.top - r.height - 2) : anchor.bottom + 2,
    });
  }, [anchor]);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(box.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', onClose);
    box.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={box}
      className={'rb-menu' + (grid ? ' grid' : '')}
      role="menu"
      aria-label={label}
      style={{ left: pos.left, top: pos.top }}
    >
      {entries.map((e) =>
        grid ? (
          <button
            key={e.l}
            role="menuitem"
            type="button"
            className={e.color ? 'sw' : 'sw glyph'}
            title={e.l}
            aria-label={e.l}
            style={{ background: e.color }}
            onClick={() => onPick(e)}
          >
            {e.color ? null : e.l}
          </button>
        ) : (
          <button key={e.l} role="menuitem" type="button" onClick={() => onPick(e)}>
            <span className="mi" style={{ color: e.color, fontFamily: e.font }} aria-hidden>
              {e.i ?? ''}
            </span>
            <span className="ml" style={{ fontFamily: e.font }}>
              {e.l}
            </span>
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

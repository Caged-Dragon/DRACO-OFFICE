import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props {
  label: string;
  items: MenuItem[];
}

export function MenuButton({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  const focusItem = (i: number) => itemRefs.current[i]?.focus();

  useEffect(() => {
    if (open && enabled.length) focusItem(enabled[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const pos = enabled.indexOf(current);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(enabled[(pos + 1) % enabled.length]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(enabled[(pos - 1 + enabled.length) % enabled.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(enabled[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(enabled[enabled.length - 1]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
      </button>
      {open && (
        <div className="menu__list" id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey}>
          {items.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              role="menuitem"
              className="menu__item"
              tabIndex={-1}
              disabled={it.disabled}
              onClick={() => {
                close(true);
                it.onSelect();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

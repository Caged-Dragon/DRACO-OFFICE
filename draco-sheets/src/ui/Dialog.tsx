import { t } from '../i18n/i18nGlue';
import { useEffect, useRef, useId, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export default function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = box.current;
    if (!el) return;
    const first =
      el.querySelector<HTMLElement>('.body ' + FOCUSABLE.split(',').join(',.body ')) ??
      el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement | null)?.closest?.('[aria-expanded="true"]')) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0],
        z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !el.contains(document.activeElement))) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (document.activeElement === z || !el.contains(document.activeElement))) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={'dialog' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header>
          <h2 id={id}>{title}</h2>
          <button className="icon" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

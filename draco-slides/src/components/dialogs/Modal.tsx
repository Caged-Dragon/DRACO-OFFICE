import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: Escape and backdrop click close it, Tab cycles inside it, and focus returns
 * to the element that opened it.
 */
export function Modal({ title, onClose, children }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Captured during the first render, before any child steals focus via autoFocus.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Deferred so a StrictMode re-mount (which sets alive back to true) does not steal focus.
      queueMicrotask(() => {
        if (!alive.current && opener?.isConnected) opener.focus();
      });
    };
  }, [opener]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        onKeyDown={onKeyDown}
      >
        <h2 id={`${id}-heading`}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

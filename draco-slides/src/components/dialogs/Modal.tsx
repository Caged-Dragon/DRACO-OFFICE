import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal dialog: Escape and backdrop click close it, and focus returns to the element that opened it. */
export function Modal({ title, onClose, children }: Props) {
  const id = useId();
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

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <h2 id={`${id}-heading`}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

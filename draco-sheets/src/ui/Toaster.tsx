import { useEffect, useState } from 'react';
import { TOAST_EVENT, type ToastDetail } from './toast';

interface Item extends ToastDetail {
  id: number;
}
/** Bottom-centre stack of short messages (3.5 s). Announced politely to screen readers. */
export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const id = ++n;
      const d = (e as CustomEvent<ToastDetail>).detail;
      setItems((a) => [...a.slice(-3), { ...d, id }]);
      window.setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), 3500);
    };
    window.addEventListener(TOAST_EVENT, on);
    return () => window.removeEventListener(TOAST_EVENT, on);
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

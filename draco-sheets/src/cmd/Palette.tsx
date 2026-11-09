import { useEffect, useMemo, useRef, useState } from 'react';
import * as G from './cmdGlue';

export default function Palette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const prev = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const results = useMemo(() => G.query(q, 12), [q]);
  useEffect(() => {
    input.current?.focus();
    const p = prev.current;
    return () => {
      p?.focus?.();
    };
  }, []);
  useEffect(() => setI(0), [q]);
  const go = async (id: string) => {
    onClose();
    await Promise.resolve();
    await G.run(id);
  };
  return (
    <div className="scrim palette-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[i] ? `pal-${results[i].id}` : undefined}
          aria-label="Search commands"
          placeholder="Type a command… (bold, freeze, insert chart)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setI((x) => Math.min(results.length - 1, x + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setI((x) => Math.max(0, x - 1));
            } else if (e.key === 'Enter' && results[i]) {
              e.preventDefault();
              void go(results[i].id);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <ul id="palette-list" role="listbox" aria-label="Commands">
          {results.map((c, k) => (
            <li
              key={c.id}
              id={`pal-${c.id}`}
              role="option"
              aria-selected={k === i}
              className={k === i ? 'on' : ''}
              onMouseEnter={() => setI(k)}
              onMouseDown={(e) => {
                e.preventDefault();
                void go(c.id);
              }}
            >
              <span className="g">{c.group}</span>
              <span className="t">{c.title}</span>
              {c.keys && <kbd>{c.keys}</kbd>}
            </li>
          ))}
          {!results.length && <li className="none">No matching command</li>}
        </ul>
      </div>
    </div>
  );
}

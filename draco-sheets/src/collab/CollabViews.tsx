import { markerClick } from './collabGlue';
import { useEffect, useRef } from 'react';
type HP = { data?: { n: number; open: boolean; sheetId: string; r: number; c: number; name?: string; color?: string } };
export function CommentMarker(p: HP) {
  const ref = useRef<HTMLButtonElement>(null); const d = p.data;
  useEffect(() => { const el = ref.current; if (!el) return; const stop = (e: Event) => e.stopPropagation(); const names = ['pointerdown', 'mousedown', 'touchstart', 'dblclick']; names.forEach((n) => el.addEventListener(n, stop)); return () => names.forEach((n) => el.removeEventListener(n, stop)); }, []);
  if (!d) return null;
  return <button ref={ref} type="button" className={`draco-cmark${d.open ? '' : ' done'}`} title={`${d.n} comment${d.n === 1 ? '' : 's'}`} aria-label={`Open ${d.n} comment${d.n === 1 ? '' : 's'}`} style={{ display: 'block', width: 12, height: 12 }} onClick={(e) => { e.stopPropagation(); markerClick(d.sheetId, d.r, d.c); }} />;
}
export function PeerCursor(p: HP) {
  const d = p.data; if (!d) return null;
  return <div className="draco-peer" style={{ borderColor: d.color, background: `${d.color}22`, pointerEvents: 'none' }}><span className="draco-peer-name" style={{ background: d.color }}>{d.name}</span></div>;
}

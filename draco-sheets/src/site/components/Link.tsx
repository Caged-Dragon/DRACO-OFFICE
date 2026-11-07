import React from 'react';

/** Client-side navigation (the Site router listens for popstate). */
export function go(to: string) { if (location.pathname + location.search === to) return; history.pushState(null, '', to); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); }
export function A({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); go(to); }}>{children}</a>;
}
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';


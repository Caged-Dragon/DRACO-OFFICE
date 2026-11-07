import { useEffect, useLayoutEffect, useState } from 'react';
import * as cmdGlue from '../cmd/cmdGlue';
import { TABS, type Item, type RibbonCtx, type RibbonTab } from './types';
import { groupsFor, allCommandIds } from './registry';
(window as unknown as { dracoRibbon: unknown }).dracoRibbon = { commands: allCommandIds };
import { syncUniverHeader } from './univerHeader';
import { RibbonTabs } from './RibbonTabs';
import { RibbonGroup } from './RibbonGroup';

const KEY_TAB = 'draco:ribbon-tab', KEY_OPEN = 'draco:ribbon-open';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/** Ribbon shell: remembers the tab and collapsed state, wires item clicks to commands. */
export default function Ribbon(x: RibbonCtx & { ready: boolean }) {
  const [tab, setTab] = useState<RibbonTab>(() => { const t = read(KEY_TAB) as RibbonTab; return TABS.includes(t) ? t : 'Home'; });
  const [open, setOpen] = useState(() => read(KEY_OPEN) !== '0');
  const pick = (t: RibbonTab) => { setTab(t); setOpen(true); write(KEY_TAB, t); write(KEY_OPEN, '1'); };
  const toggle = () => { setOpen(!open); write(KEY_OPEN, open ? '0' : '1'); };
  useLayoutEffect(() => { if (!x.ready) return; syncUniverHeader(tab); const id = window.setTimeout(() => syncUniverHeader(tab), 400); return () => window.clearTimeout(id); }, [tab, x.ready, open]);
  useEffect(() => { if (!x.ready) return; const g = document.querySelector('main.grid'); if (!g) return; const mo = new MutationObserver(() => syncUniverHeader(tab)); mo.observe(g, { childList: true }); return () => mo.disconnect(); }, [x.ready, tab]);
  const run = (it: Item) => { if (it.run) it.run(); else if (it.c) void cmdGlue.run(it.c); };
  return (
    <div className={'ribbon' + (open ? '' : ' collapsed')} role="region" aria-label="Ribbon">
      <RibbonTabs tab={tab} open={open} onPick={pick} onToggle={toggle} />
      {open && <div className="rb-panel" role="tabpanel" aria-label={tab}>{groupsFor(tab, x).map((g) => <RibbonGroup key={g.n} group={g} onRun={run} />)}</div>}
    </div>
  );
}

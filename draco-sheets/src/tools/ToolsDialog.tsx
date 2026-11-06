import { useState } from 'react';
import Dialog from '../Dialog';
import type { Engine } from '../engine';
import { MacrosTab, ScriptsTab } from '../auto/AutoTabs';
import TablesTab from '../tables/TablesTab';
import AnalysisTab from '../analysis/AnalysisTab';
import LinksTab from '../links/LinksTab';
import AccessTab from '../a11y/AccessTab';
import PerfTab from '../perf/PerfTab';
import LangTab from '../i18n/LangTab';
import { t } from '../i18n/i18nGlue';
import { TemplatesTab, KeysTab, ParityTab } from '../gallery/GalleryTab';

export type ToolsTab = 'macros' | 'scripts' | 'links' | 'access' | 'perf' | 'lang' | 'templates' | 'keys' | 'parity' | 'analysis' | 'tables';
export const TOOLS_TABS: Array<[ToolsTab, string]> = [['macros', 'Macros'], ['scripts', 'Scripts'], ['links', 'Links & web data'], ['access', 'Accessibility'], ['perf', 'Large data'], ['lang', 'Language'], ['templates', 'Templates & themes'], ['keys', 'Shortcuts'], ['tables', 'Tables'], ['analysis', 'Analysis ToolPak'], ['parity', 'Parity report']];
export default function ToolsDialog({ engine, tab: first = 'macros', openTemplate, onRoadmap, onClose }: { engine: Engine; tab?: ToolsTab; openTemplate: (id: string) => void; onRoadmap: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<ToolsTab>(first); const [seed, setSeed] = useState<{ code: string; name: string } | null>(null);
  const onKey = (e: React.KeyboardEvent) => { const i = TOOLS_TABS.findIndex(([k]) => k === tab); let n = -1; if (e.key === 'ArrowRight') n = (i + 1) % TOOLS_TABS.length; else if (e.key === 'ArrowLeft') n = (i + TOOLS_TABS.length - 1) % TOOLS_TABS.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = TOOLS_TABS.length - 1; if (n >= 0) { e.preventDefault(); setTab(TOOLS_TABS[n][0]); requestAnimationFrame(() => document.getElementById('tools-tab-' + TOOLS_TABS[n][0])?.focus()); } };
  return (
    <Dialog title={t('Tools')} onClose={onClose} wide>
      <div className="chart-list" role="tablist" aria-label="Tools sections" onKeyDown={onKey}>
        {TOOLS_TABS.map(([k, l]) => <button key={k} id={'tools-tab-' + k} role="tab" aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>)}
      </div>
      <div role="tabpanel" aria-labelledby={'tools-tab-' + tab}>
        {tab === 'macros' && <MacrosTab openInScripts={(code, name) => { setSeed({ code, name }); setTab('scripts'); }} />}
        {tab === 'scripts' && <ScriptsTab seed={seed} />}
        {tab === 'tables' && <TablesTab engine={engine} />}
        {tab === 'analysis' && <AnalysisTab engine={engine} />}
        {tab === 'links' && <LinksTab engine={engine} />}
        {tab === 'access' && <AccessTab engine={engine} />}
        {tab === 'perf' && <PerfTab engine={engine} />}
        {tab === 'lang' && <LangTab engine={engine} />}
        {tab === 'templates' && <TemplatesTab engine={engine} openTemplate={(id) => { openTemplate(id); onClose(); }} />}
        {tab === 'keys' && <KeysTab />}
        {tab === 'parity' && <ParityTab engine={engine} onRoadmap={onRoadmap} />}
      </div>
    </Dialog>
  );
}

import type { Group, RibbonCtx } from '../types';

/** Data tab */
export const dataGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Get & Transform', items: [{ l: 'Get data', i: '🛢', c: 'open.query' }, { l: 'From text / web', i: '🌐', c: 'open.links' }] },
      { n: 'Queries', items: [{ l: 'Refresh all', i: '⟳', c: 'open.query' }, { l: 'Queries', i: '☷', c: 'open.query' }] },
      { n: 'Sort & Filter', items: [{ l: 'Sort A→Z', i: 'A↓', c: 'data.sortaz' }, { l: 'Sort Z→A', i: 'Z↓', c: 'data.sortza' }, { l: 'Filter', i: '⛛', c: 'data.filter' }] },
      { n: 'Data Tools', items: [{ l: 'Text to columns', i: '⫼', c: 'open.data.text' }, { l: 'Remove duplicates', i: '⊟', c: 'open.data.dupes' }, { l: 'Flash Fill', i: '⚡', c: 'open.data.flash' }, { l: 'Advanced filter', i: '⛛', c: 'open.data.adv' }, { l: 'Data validation', i: '✔', c: 'open.data' }, { l: 'Consolidate', i: '⧉', c: 'open.data.consol' }] },
      { n: 'Forecast', items: [{ l: 'What-if analysis', i: '❓', c: 'open.data.whatif' }, { l: 'Forecast sheet', i: '📈', c: 'open.analysis' }] },
      { n: 'Outline', items: [{ l: 'Subtotal', i: '⊞', c: 'open.data.subtotal' }] },
];

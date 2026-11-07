import type { Group, RibbonCtx } from '../types';

/** Data tab */
export const dataGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Get & Transform', items: [{ l: 'Get data', i: '🛢', c: 'open.query' }, { l: 'From text / web', i: '🌐', c: 'open.links' }] },
      { n: 'Queries', items: [{ l: 'Refresh all', i: '⟳', c: 'open.query' }, { l: 'Queries', i: '☷', c: 'open.query' }] },
      { n: 'Sort & Filter', items: [{ l: 'Sort A→Z', i: 'A↓', c: 'data.sortaz' }, { l: 'Sort Z→A', i: 'Z↓', c: 'data.sortza' }, { l: 'Filter', i: '⛛', c: 'data.filter' }] },
      { n: 'Data Tools', items: [{ l: 'Text to columns', i: '⫼', c: 'open.data' }, { l: 'Remove duplicates', i: '⊟', c: 'open.data' }, { l: 'Data validation', i: '✔', c: 'open.data' }, { l: 'Consolidate', i: '⧉', c: 'open.data' }] },
      { n: 'Forecast', items: [{ l: 'What-if analysis', i: '❓', c: 'open.data' }, { l: 'Forecast sheet', i: '📈', c: 'open.analysis' }] },
      { n: 'Outline', items: [{ l: 'Group / Subtotal', i: '⊞', c: 'open.data' }] },
];

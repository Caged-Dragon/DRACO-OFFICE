import { bigGroup, stacked, type Group, type RibbonCtx } from '../types';

/** Data tab */
export const dataGroups = (_x: RibbonCtx): Group[] => [
  bigGroup('Get & Transform', [
    { l: 'Get data', i: '🛢', c: 'open.query' },
    { l: 'From text / web', i: '🌐', c: 'open.links' },
  ]),
  bigGroup('Queries', [
    { l: 'Refresh all', i: '⟳', c: 'open.query' },
    { l: 'Queries', i: '☷', c: 'open.query' },
  ]),
  stacked('Sort & Filter', [
    [
      { l: 'Sort A→Z', i: 'A↓', c: 'data.sortaz' },
      { l: 'Sort Z→A', i: 'Z↓', c: 'data.sortza' },
    ],
    [
      { l: 'Filter', i: '⛛', c: 'data.filter' },
      { l: 'Advanced filter', i: '⛛', c: 'open.data.adv' },
    ],
  ]),
  stacked('Data Tools', [
    [
      { l: 'Text to columns', i: '⫼', c: 'open.data.text' },
      { l: 'Flash Fill', i: '⚡', c: 'open.data.flash' },
      { l: 'Remove duplicates', i: '⊟', c: 'open.data.dupes' },
    ],
    [
      { l: 'Data validation', i: '✔', c: 'open.data' },
      { l: 'Consolidate', i: '⧉', c: 'open.data.consol' },
    ],
  ]),
  bigGroup('Forecast', [
    { l: 'What-if analysis', i: '❓', c: 'open.data.whatif' },
    { l: 'Forecast sheet', i: '📈', c: 'open.analysis' },
  ]),
  bigGroup('Outline', [{ l: 'Subtotal', i: '⊞', c: 'open.data.subtotal' }]),
];

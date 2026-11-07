import type { Group, RibbonCtx } from '../types';

/** Draw tab */
export const drawGroups = (_x: RibbonCtx): Group[] => [
      { n: 'Shapes', items: [{ l: 'Shapes & pictures', i: '⬠', c: 'open.objects' }, { l: 'Text box', i: '🅣', c: 'open.objects' }] },
      { n: 'Note', items: [{ l: 'Freehand ink is not available yet. Shapes, text boxes and pictures are in Insert.', i: 'ⓘ', size: 's', run: () => undefined }] },
];

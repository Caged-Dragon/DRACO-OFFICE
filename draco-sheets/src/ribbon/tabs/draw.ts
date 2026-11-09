import { bigGroup, type Group, type RibbonCtx } from '../types';

/** Draw tab (freehand ink is not available yet) */
export const drawGroups = (_x: RibbonCtx): Group[] => [
  bigGroup('Shapes', [
    { l: 'Shapes & pictures', i: '⬠', c: 'open.objects' },
    { l: 'Text box', i: '🅣', c: 'insert.shape.text' },
  ]),
];

import type { Group } from '../../types';
import { cellsGroup } from './cells';
import { visibilityGroup } from './visibility';
import { editingGroup } from './editing';
import { sortFilterGroup } from './sortFilter';
import { numberGroup } from './number';
import { stylesGroup } from './styles';

/** Home tab = the groups below, left to right (Univer's own toolbar supplies clipboard, font and alignment). */
export const homeGroups = (): Group[] => [cellsGroup, visibilityGroup, editingGroup, sortFilterGroup, numberGroup, stylesGroup];

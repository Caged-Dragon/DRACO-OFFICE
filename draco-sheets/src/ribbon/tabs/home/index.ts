import type { Group } from '../../types';
import { clipboardGroup } from './clipboard';
import { fontGroup } from './font';
import { alignmentGroup } from './alignment';
import { numberGroup } from './number';
import { stylesGroup } from './styles';
import { cellsGroup } from './cells';
import { editingGroup } from './editing';

/** Home tab = the groups below, left to right, in Excel's order. */
export const homeGroups = (): Group[] => [
  clipboardGroup,
  fontGroup,
  alignmentGroup,
  numberGroup,
  stylesGroup,
  cellsGroup,
  editingGroup,
];

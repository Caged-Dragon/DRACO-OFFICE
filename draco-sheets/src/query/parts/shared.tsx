export { Check, Field, Result } from '../../ui/form';
import { type ReactNode } from 'react';
import type { Engine } from '../../core/engine';
import { applyStep, type FilterOp, type Step, type Table } from '../query';
import type { Out } from '../../data/dataGlue';

export const move = <T,>(a: T[], i: number, d: number): T[] => {
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  const c = [...a];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
};

export const OPS: Array<[FilterOp, string]> = [
  ['=', 'equals'],
  ['!=', 'does not equal'],
  ['>', 'greater than'],
  ['>=', 'greater or equal'],
  ['<', 'less than'],
  ['<=', 'less or equal'],
  ['contains', 'contains'],
  ['notContains', 'does not contain'],
  ['startsWith', 'begins with'],
  ['endsWith', 'ends with'],
  ['isBlank', 'is blank'],
  ['notBlank', 'is not blank'],
];

export const STEP_TYPES: Array<[Step['t'], string]> = [
  ['filter', 'Filter rows'],
  ['removeCols', 'Remove columns'],
  ['keepCols', 'Keep columns'],
  ['rename', 'Rename column'],
  ['type', 'Change type'],
  ['sort', 'Sort'],
  ['split', 'Split column'],
  ['merge', 'Merge columns'],
  ['addCol', 'Add calculated column'],
  ['replace', 'Replace values'],
  ['text', 'Transform text'],
  ['dedupe', 'Remove duplicates'],
  ['removeBlankRows', 'Remove blank rows'],
  ['fillDown', 'Fill down'],
  ['keepRows', 'Keep top/bottom rows'],
  ['removeRows', 'Remove top/bottom rows'],
  ['group', 'Group by'],
  ['unpivot', 'Unpivot columns'],
  ['append', 'Append another table'],
  ['join', 'Merge (join) another table'],
];

export function runUpTo(base: Table | undefined, steps: Step[], engine: Engine): Table | undefined {
  void engine;
  if (!base) return undefined;
  let t = base;
  for (const s of steps) {
    const r = previewTable(t, s);
    if (!r) return t;
    t = r;
  }
  return t;
}

export function previewTable(t: Table, s: Step): Table | null {
  try {
    return applyStep(t, s, () => null);
  } catch {
    return null;
  }
}

export { Check, Field, Result } from '../../ui/form';
import { type ReactNode } from 'react';
import { type Out } from '../../data/dataGlue';

export const move = <T,>(a: T[], i: number, d: number): T[] => {
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  const c = [...a];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
};

export { Check, Field, Result } from '../../ui/form';
import { type ReactNode } from 'react';
import type { Out } from '../../data/dataGlue';
import { type Snap } from '../model';
import { type Imported } from '../filesGlue';
import { type Paper } from '../print';

export type Tab = 'files' | 'print' | 'paste' | 'versions';

export interface FilesCtx {
  id: string;
  title: string;
  getSnapshot: () => Snap | null;
  onImport: (imp: Imported) => void;
  onRestore: (snap: Snap, label: string) => void;
  onSetupChanged: () => void;
  markCheckpoint?: (hash: string) => void;
}

export const PAPERS: Array<[Paper, string]> = [
  ['letter', 'Letter'],
  ['legal', 'Legal'],
  ['tabloid', 'Tabloid'],
  ['a4', 'A4'],
  ['a3', 'A3'],
  ['a5', 'A5'],
];

export const nums = (s: string): number[] =>
  s
    .split(/[,\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((x) => x > 0)
    .map((x) => x - 1);

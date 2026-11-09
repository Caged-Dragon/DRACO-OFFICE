export { Check, Field, Result } from '../../ui/form';
import { useSyncExternalStore, type ReactNode } from 'react';
import * as G from '../collabGlue';
import { download } from '../../files/filesGlue';

export type Out = { ok: boolean; message: string; [k: string]: unknown };

export type CollabTab = 'comments' | 'notes' | 'share' | 'changes' | 'protect';

export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
};

export const useCollab = () => useSyncExternalStore(G.subscribe, G.version);

export const colName = (c: number) => {
  let s = '',
    n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export const addr = (r: number, c: number) => `${colName(c)}${r + 1}`;

export const saveText = (name: string, text: string, mime = 'text/csv') =>
  download({ name, data: text, mime: mime + ';charset=utf-8' });

export type Tab = 'names' | 'audit' | 'evaluate' | 'errors' | 'watch' | 'calc';

export interface Watch {
  sheet: string;
  row: number;
  col: number;
}

export const WATCH_KEY = 'draco:watch';

export const loadWatch = (): Watch[] => {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]');
  } catch {
    return [];
  }
};

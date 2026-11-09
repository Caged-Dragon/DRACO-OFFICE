// Pure bulk computations used by the background worker (v97) and as the in-thread fallback. No DOM, no engine.
import { removeDuplicates, type Grid } from '../data/dataTools';
import { maxOf, minOf } from '../formulas/safeMath';

export interface ColStats {
  count: number;
  numbers: number;
  blanks: number;
  distinct: number;
  sum: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
}
export function columnStats(col: Array<string | number | boolean | null | undefined>): ColStats {
  const nums: number[] = [];
  const seen = new Set<string>();
  let blanks = 0;
  for (const v of col) {
    if (v === null || v === undefined || v === '') {
      blanks++;
      continue;
    }
    seen.add(String(v));
    if (typeof v === 'number' && Number.isFinite(v)) nums.push(v);
    else if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v.replace(/,/g, '')))
      nums.push(+v.replace(/,/g, ''));
  }
  let sum = 0;
  for (const n of nums) sum += n;
  const sorted = nums.slice().sort((a, b) => a - b);
  const m = sorted.length >> 1;
  return {
    count: col.length - blanks,
    numbers: nums.length,
    blanks,
    distinct: seen.size,
    sum,
    mean: nums.length ? sum / nums.length : null,
    min: nums.length ? minOf(nums) : null,
    max: nums.length ? maxOf(nums) : null,
    median: nums.length ? (sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2) : null,
  };
}
export type BulkReq =
  | { op: 'dedupe'; rows: Grid; cols: number[]; hasHeader: boolean; caseSensitive: boolean }
  | { op: 'stats'; cols: Array<Array<string | number | boolean | null | undefined>> }
  | { op: 'ping' };
export type BulkRes =
  | { op: 'dedupe'; removedRows: number[]; removed: number }
  | { op: 'stats'; stats: ColStats[] }
  | { op: 'ping'; at: number };
export function runBulk(r: BulkReq): BulkRes {
  if (r.op === 'dedupe') {
    const d = removeDuplicates(r.rows, { cols: r.cols, hasHeader: r.hasHeader, caseSensitive: r.caseSensitive });
    return { op: 'dedupe', removedRows: d.removedRows, removed: d.removed };
  }
  if (r.op === 'stats') return { op: 'stats', stats: r.cols.map(columnStats) };
  return { op: 'ping', at: Date.now() };
}

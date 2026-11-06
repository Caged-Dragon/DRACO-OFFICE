// Performance helpers (v97): limits, chunk planning, deterministic test data, timing summaries. Pure.
export const EXCEL_LIMITS = { rows: 1_048_576, cols: 16_384 } as const;
export function chunkPlan(total: number, size: number): Array<{ start: number; count: number }> { if (total <= 0) return []; size = Math.max(1, Math.floor(size)); const out: Array<{ start: number; count: number }> = []; for (let s = 0; s < total; s += size) out.push({ start: s, count: Math.min(size, total - s) }); return out; }
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'];
/** Row i of test data: id, word, number, category, date serial, amount (repeats every 6 columns). Same inputs → same data. */
export function genRows(start: number, count: number, cols: number, seed = 1): Array<Array<string | number>> {
  const out: Array<Array<string | number>> = [];
  for (let i = start; i < start + count; i++) { const r = rng(seed * 1_000_003 + i); const row: Array<string | number> = []; for (let c = 0; c < cols; c++) { switch (c % 6) { case 0: row.push(i + 1); break; case 1: row.push(WORDS[Math.floor(r() * WORDS.length)] + '-' + (Math.floor(r() * 900) + 100)); break; case 2: row.push(Math.round(r() * 100000) / 100); break; case 3: row.push(['North', 'South', 'East', 'West'][Math.floor(r() * 4)]); break; case 4: row.push(44927 + Math.floor(r() * 730)); break; default: row.push(Math.round(r() * 5000 * 100) / 100); } } out.push(row); }
  return out;
}
export const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);
export const fmtCount = (n: number) => n.toLocaleString('en-US');
export const cellsOf = (rows: number, cols: number) => rows * cols;
export interface Step { name: string; ms: number; note?: string }
export function summarize(steps: Step[]): { total: number; slowest?: Step } { return { total: steps.reduce((a, s) => a + s.ms, 0), slowest: steps.slice().sort((a, b) => b.ms - a.ms)[0] }; }
/** Rough memory the engine needs for the cells (about 90 bytes per filled cell) — a guide for the warning, not a measurement. */
export const estimateMB = (cells: number) => Math.round((cells * 90) / 1_048_576);
export function warnFor(rows: number, cols: number): string | null { const cells = rows * cols; if (cells > 5_000_000) return `${fmtCount(cells)} cells needs roughly ${estimateMB(cells)} MB of memory and a long time to save; most devices will struggle.`; if (cells > 1_000_000) return `${fmtCount(cells)} cells will take a while and make saving slower.`; return null; }
export function a1End(rows: number, cols: number) { let s = '', n = cols; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return `A1:${s}${rows}`; }

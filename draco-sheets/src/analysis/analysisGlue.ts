// Engine glue for the Analysis ToolPak (v1.0.0): reads columns, runs the pure stats, writes the report grid.
import type { Engine } from '../engine';
import { parseRef, writeGrid, type Out } from '../dataGlue';
import * as T from './toolpak';

export type Tool = 'descriptive' | 'correlation' | 'covariance' | 'regression' | 'ttest-paired' | 'ttest-equal' | 'ttest-unequal' | 'ztest' | 'ftest' | 'anova' | 'rank' | 'movavg' | 'expsmooth' | 'histogram' | 'sampling';
export const TOOLS: Array<[Tool, string, string]> = [
  ['descriptive', 'Descriptive Statistics', 'One or more columns'], ['correlation', 'Correlation', 'Two or more columns'], ['covariance', 'Covariance', 'Two or more columns'],
  ['regression', 'Regression', 'Y range, then X range(s)'], ['ttest-paired', 't-Test: Paired Two Sample', 'Two columns'], ['ttest-equal', 't-Test: Two-Sample Equal Variances', 'Two columns'], ['ttest-unequal', 't-Test: Two-Sample Unequal Variances', 'Two columns'],
  ['ztest', 'z-Test: Two Sample for Means', 'Two columns + known variances'], ['ftest', 'F-Test: Two-Sample for Variances', 'Two columns'], ['anova', 'ANOVA: Single Factor', 'Two or more columns (one per group)'],
  ['rank', 'Rank and Percentile', 'One column'], ['movavg', 'Moving Average', 'One column'], ['expsmooth', 'Exponential Smoothing', 'One column'], ['histogram', 'Histogram (counts per bin)', 'One column + bin range'], ['sampling', 'Sampling', 'One column'],
];
export interface Opts { tool: Tool; input: string; input2?: string; labels: boolean; output?: string; period?: number; damping?: number; confidence?: number; alpha?: number; varA?: number; varB?: number; sampleN?: number; periodic?: boolean; seed?: number }

function columns(e: Engine, ref: string, labels: boolean): { name: string; values: number[] }[] | string {
  const l = parseRef(e, ref); if (!l) return `Can't read the range "${ref}".`;
  const g = l.rng.getValues() as unknown[][]; const out = [];
  for (let c = 0; c < l.cols; c++) { const col = g.map((r) => r[c]); const name = labels ? String(col[0] ?? `Column ${c + 1}`) : `Column ${c + 1}`; out.push({ name, values: T.nums(labels ? col.slice(1) : col) }); }
  return out.some((c) => c.values.length === 0) ? 'One of the columns has no numbers in it.' : out;
}
export function build(e: Engine, o: Opts): { ok: true; grid: T.G } | { ok: false; message: string } {
  const bad = (message: string) => ({ ok: false as const, message });
  const A = columns(e, o.input, o.labels); if (typeof A === 'string') return bad(A);
  const one = A[0].values; const two = () => (A.length >= 2 ? [A[0].values, A[1].values] : null);
  switch (o.tool) {
    case 'descriptive': return { ok: true, grid: T.descriptive(A, o.confidence ?? 0.95) };
    case 'correlation': return A.length < 2 ? bad('Select at least two columns.') : { ok: true, grid: T.correlation(A) };
    case 'covariance': return A.length < 2 ? bad('Select at least two columns.') : { ok: true, grid: T.covariance(A) };
    case 'regression': { if (!o.input2) return bad('Enter the X range.'); const X = columns(e, o.input2, o.labels); if (typeof X === 'string') return bad(X); if (A.length !== 1) return bad('Y must be a single column.'); if (X.some((x) => x.values.length !== one.length)) return bad('Y and X columns must have the same number of numeric rows.'); return { ok: true, grid: T.regressionGrid(one, X.map((x) => x.values), X.map((x) => x.name)) }; }
    case 'ttest-paired': case 'ttest-equal': case 'ttest-unequal': { const p = two(); if (!p) return bad('Select two columns.'); return { ok: true, grid: T.tTest(p[0], p[1], o.tool === 'ttest-paired' ? 'paired' : o.tool === 'ttest-equal' ? 'equal' : 'unequal', o.alpha ?? 0.05) }; }
    case 'ztest': { const p = two(); if (!p) return bad('Select two columns.'); if (!(o.varA! > 0) || !(o.varB! > 0)) return bad('Enter both known variances (greater than 0).'); return { ok: true, grid: T.zTest(p[0], p[1], o.varA!, o.varB!) }; }
    case 'ftest': { const p = two(); if (!p) return bad('Select two columns.'); return { ok: true, grid: T.fTest(p[0], p[1]) }; }
    case 'anova': return A.length < 2 ? bad('Select at least two columns (one per group).') : { ok: true, grid: T.anova(A, o.alpha ?? 0.05) };
    case 'rank': return { ok: true, grid: T.rankPercentile(one) };
    case 'movavg': return { ok: true, grid: T.movingAverage(one, Math.max(1, Math.round(o.period ?? 3))) };
    case 'expsmooth': return { ok: true, grid: T.expSmoothing(one, o.damping ?? 0.3) };
    case 'histogram': { if (!o.input2) return bad('Enter the bin range.'); const B = columns(e, o.input2, false); if (typeof B === 'string') return bad(B); return { ok: true, grid: T.histogramBins(one, B[0].values) }; }
    case 'sampling': return { ok: true, grid: T.sample(one, Math.max(1, Math.round(o.sampleN ?? 10)), o.seed ?? 1, !!o.periodic) };
  }
}
export function run(e: Engine, o: Opts): Out & { grid?: T.G; at?: string } {
  const b = build(e, o); if (!b.ok) return b;
  const wb = e.api.getActiveWorkbook(); if (!wb) return { ok: false, message: 'No workbook open.' };
  const title = TOOLS.find((t) => t[0] === o.tool)![1]; let sheet = wb.getActiveSheet(), r0 = 0, c0 = 0, at = 'a new sheet';
  if (o.output?.trim()) { const l = parseRef(e, o.output); if (!l) return { ok: false, message: `Can't read the output cell "${o.output}".` }; sheet = l.sheet; r0 = l.r0; c0 = l.c0; at = o.output.trim(); }
  else { const base = title.split(':')[0].replace(/[^\w ]/g, '').slice(0, 20); let name = base, i = 2; while (wb.getSheetByName(name)) name = `${base} ${i++}`; sheet = wb.insertSheet(name); at = name; }
  const w = Math.max(...b.grid.map((r) => r.length)); writeGrid(sheet, r0, c0, b.grid.map((r) => Array.from({ length: w }, (_, i) => (r[i] ?? '') as never)) as never);
  return { ok: true, message: `${title} written to ${at} (${b.grid.length} rows).`, grid: b.grid, at };
}
export function install(w: Record<string, unknown>, e: () => Engine) { w.dracoAnalysis = { tools: TOOLS.map((t) => t[0]), run: (o: Opts) => run(e(), o), preview: (o: Opts) => build(e(), o) }; }

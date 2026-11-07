/** Read native Excel charts back out of an .xlsx (drawing + chart parts) into Draco chart objects. */
import JSZip from 'jszip';
import { specFromGrid, type ChartType } from '../charts/render';

export interface InChart { id: string; key: string; sheet: string; left: number; top: number; width: number; height: number; data: unknown }
type Cell = { v?: unknown } | undefined; type SheetGrid = Record<string, Record<string, Cell>>;
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const parseRef = (f: string): { sheet: string; r0: number; c0: number; r1: number; c1: number } | null => {
  const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(unesc(f).trim()); if (!m) return null;
  const sheet = (m[1] ?? m[2]).replace(/''/g, "'"); const c0 = colNum(m[3]), r0 = +m[4] - 1; return { sheet, r0, c0, r1: m[6] ? +m[6] - 1 : r0, c1: m[5] ? colNum(m[5]) : c0 };
};
const rels = (xml: string) => [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => ({ id: /\bId="([^"]*)"/.exec(m[0])?.[1] ?? '', target: /\bTarget="([^"]*)"/.exec(m[0])?.[1] ?? '' }));
const resolve = (base: string, target: string) => { if (target.startsWith('/')) return target.slice(1); const parts = base.split('/'); parts.pop(); for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); } return parts.join('/'); };
const first = (xml: string, re: RegExp) => re.exec(xml)?.[1];

function chartFrom(xml: string, grids: Record<string, SheetGrid>): { type: ChartType; title: string; sheet: string; range: string; byRows: boolean; legend?: string } | null {
  const kinds: Array<[RegExp, (x: string) => ChartType]> = [[/<c:barChart>/, (x) => (/<c:barDir val="bar"/.test(x) ? 'bar' : 'column')], [/<c:lineChart>/, () => 'line'], [/<c:areaChart>/, () => 'area'], [/<c:pieChart>/, () => 'pie'], [/<c:doughnutChart>/, () => 'doughnut'], [/<c:scatterChart>/, () => 'scatter']];
  const k = kinds.find(([re]) => re.test(xml)); if (!k) return null; const type = k[1](xml);
  const sers = [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map((m) => m[1]); if (!sers.length) return null;
  const refs: Array<NonNullable<ReturnType<typeof parseRef>>> = []; let cols = 0, rows = 0; let sheet = '';
  for (const s of sers) { const name = first(s, /<c:tx>[\s\S]*?<c:f>([^<]*)<\/c:f>/); const cat = first(s, /<c:(?:cat|xVal)>[\s\S]*?<c:f>([^<]*)<\/c:f>/); const val = first(s, /<c:(?:val|yVal)>[\s\S]*?<c:f>([^<]*)<\/c:f>/); if (!val) return null;
    for (const f of [name, cat, val]) { if (!f) continue; const r = parseRef(f); if (!r) return null; if (sheet && r.sheet !== sheet) return null; sheet = r.sheet; refs.push(r); }
    const v = parseRef(val); if (v) { if (v.r1 > v.r0) cols++; else rows++; } }
  if (!refs.length || !sheet || !grids[sheet]) return null;
  const r0 = Math.min(...refs.map((r) => r.r0)), c0 = Math.min(...refs.map((r) => r.c0)), r1 = Math.max(...refs.map((r) => r.r1)), c1 = Math.max(...refs.map((r) => r.c1));
  const col = (n: number) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  const title = unesc([...(first(xml, /<c:title>([\s\S]*?)<\/c:title>/) ?? '').matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''));
  const lp = first(xml, /<c:legendPos val="(\w)"/); const legend = /<c:legend>/.test(xml) ? ({ t: 'top', b: 'bottom', l: 'left', r: 'right' } as Record<string, string>)[lp ?? 'r'] : 'none';
  return { type, title, sheet, range: `${col(c0)}${r0 + 1}:${col(c1)}${r1 + 1}`, byRows: rows > cols, legend };
}

export async function readCharts(buf: ArrayBuffer | Uint8Array, grids: Record<string, SheetGrid>): Promise<InChart[]> {
  const out: InChart[] = []; let zip: JSZip; try { zip = await JSZip.loadAsync(buf); } catch { return out; }
  const wbXml = await zip.file('xl/workbook.xml')?.async('string'); const wbRel = await zip.file('xl/_rels/workbook.xml.rels')?.async('string'); if (!wbXml || !wbRel) return out;
  const relMap = new Map(rels(wbRel).map((r) => [r.id, r.target]));
  let n = 0;
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unesc(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? ''); const rid = /\br:id="([^"]*)"/.exec(m[0])?.[1] ?? ''; const target = relMap.get(rid); if (!target) continue;
    const sheetPath = resolve('xl/workbook.xml', target); const relPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels'); const sr = await zip.file(relPath)?.async('string'); if (!sr) continue;
    for (const dr of rels(sr).filter((r) => /drawing/i.test(r.target) && !/vml/i.test(r.target))) {
      const dPath = resolve(sheetPath, dr.target); const dXml = await zip.file(dPath)?.async('string'); const dRels = await zip.file(dPath.replace(/([^/]+)$/, '_rels/$1.rels'))?.async('string'); if (!dXml || !dRels) continue;
      const dMap = new Map(rels(dRels).map((r) => [r.id, r.target]));
      for (const a of dXml.matchAll(/<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
        const rid2 = /<c:chart\b[^>]*r:id="([^"]*)"/.exec(a[0])?.[1]; if (!rid2) continue; const cp = dMap.get(rid2); if (!cp) continue;
        const cx = await zip.file(resolve(dPath, cp))?.async('string'); if (!cx) continue; const c = chartFrom(cx, grids); if (!c) continue;
        const num = (re: RegExp) => +(first(a[0], re) ?? 0);
        const col = num(/<xdr:from>[\s\S]*?<xdr:col>(\d+)</), row = num(/<xdr:from>[\s\S]*?<xdr:row>(\d+)</);
        let w = 480, h = 288; const ext = /<xdr:ext cx="(\d+)" cy="(\d+)"/.exec(a[0]); if (ext) { w = Math.round(+ext[1] / 9525); h = Math.round(+ext[2] / 9525); } else if (a[1] === 'twoCellAnchor') { const c2 = num(/<xdr:to>[\s\S]*?<xdr:col>(\d+)</), r2 = num(/<xdr:to>[\s\S]*?<xdr:row>(\d+)</); w = Math.max(160, (c2 - col) * 64); h = Math.max(120, (r2 - row) * 20); }
        // build the data grid for the spec (header row + category column, transposed when the series run along rows)
        const g = grids[c.sheet]; const [p, q] = c.range.split(':'); const pr = /([A-Z]+)(\d+)/.exec(p)!, qr = /([A-Z]+)(\d+)/.exec(q)!; const gr: Array<Array<string | number | null>> = [];
        for (let r = +pr[2] - 1; r <= +qr[2] - 1; r++) { const rowv: Array<string | number | null> = []; for (let cc = colNum(pr[1]); cc <= colNum(qr[1]); cc++) { const v = g[r]?.[cc]?.v; rowv.push(typeof v === 'number' || typeof v === 'string' ? v : v == null ? null : String(v)); } gr.push(rowv); }
        const grid = c.byRows ? (gr[0] ?? []).map((_, ci) => gr.map((rr) => rr[ci] ?? null)) : gr; const spec = specFromGrid(grid, c.type, c.title); spec.opts = { ...(c.legend ? { legend: c.legend as never } : {}) };
        n++; out.push({ id: `xl_chart_${n}`, key: 'draco-chart', sheet: name, left: 46 + col * 64, top: 20 + row * 20, width: w, height: h, data: { spec, sheet: c.sheet, range: c.range, type: c.type, title: c.title, byRows: c.byRows, opts: spec.opts } });
      }
    }
  }
  return out;
}

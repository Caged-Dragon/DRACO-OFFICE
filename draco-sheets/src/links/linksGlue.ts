// v95 glue: hyperlink insertion/listing and web-data connections (built on the query engine).
import type { Engine } from '../core/engine';
import * as L from './links';
import * as Q from '../query/queryGlue';
type Out = { ok: boolean; message: string; id?: string };
const ok = (message: string, x: { id?: string } = {}): Out => ({ ok: true, message, ...x });
const fail = (message: string): Out => ({ ok: false, message });
const wbOf = (e: Engine) => e.api.getActiveWorkbook();
type FR = {
  setHyperLink(u: string, l?: string, t?: string): Promise<boolean>;
  getHyperLinks(): Array<{ id: string; row: number; column: number; url: string; label?: string }>;
  cancelHyperLink(h?: unknown): boolean;
};
export type InsertSpec = {
  type: 'web' | 'mail' | 'sheet' | 'cell' | 'name';
  target: string;
  label?: string;
  tip?: string;
};
export async function insertLink(e: Engine, s: InsertSpec): Promise<Out> {
  const wb = wbOf(e);
  const rg = wb?.getActiveRange();
  if (!wb || !rg) return fail('Select a cell first');
  let url = '';
  if (s.type === 'web' || s.type === 'mail') {
    const n = L.normalizeUrl(s.type === 'mail' && !/^mailto:/i.test(s.target) ? 'mailto:' + s.target.trim() : s.target);
    if (!n.ok) return fail(n.reason);
    url = n.url;
  } else if (s.type === 'sheet') {
    const sh = wb.getSheetByName(s.target);
    if (!sh) return fail(`There is no sheet named "${s.target}"`);
    url = L.sheetLink(sh.getSheetId(), 'A1');
  } else if (s.type === 'cell') {
    const m = /^(?:'?([^'!]+)'?!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)$/.exec(s.target.trim());
    if (!m) return fail('Use a reference like B2 or Sheet2!A1:C3');
    const sh = m[1] ? wb.getSheetByName(m[1]) : wb.getActiveSheet();
    if (!sh) return fail(`There is no sheet named "${m[1]}"`);
    url = L.sheetLink(sh.getSheetId(), m[2]);
  } else {
    try {
      url = (wb as unknown as { getUrlOfDefineName(n: string): string }).getUrlOfDefineName(s.target.trim());
    } catch {
      return fail(`There is no named range "${s.target}"`);
    }
  }
  const label = s.label?.trim() || (s.type === 'web' || s.type === 'mail' ? s.target.trim() : s.target.trim());
  const done = await (rg as unknown as FR).setHyperLink(url, label, s.tip);
  return done ? ok(`Link added to ${rg.getA1Notation()}`) : fail('The engine could not add the link');
}
export interface LinkRow {
  sheet: string;
  sheetId: string;
  row: number;
  col: number;
  a1: string;
  text: string;
  url: string;
  kind: L.LinkKind;
  label: string;
  broken?: string;
}
const colName = (c: number) => {
  let s = '',
    n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
export function listLinks(e: Engine): LinkRow[] {
  const wb = wbOf(e);
  if (!wb) return [];
  const ids = new Set(wb.getSheets().map((s) => s.getSheetId()));
  const out: LinkRow[] = [];
  for (const ws of wb.getSheets()) {
    let links: ReturnType<FR['getHyperLinks']> = [];
    try {
      links = (ws.getDataRange() as unknown as FR).getHyperLinks();
    } catch {
      /* empty sheet */
    }
    for (const h of links) {
      const c = L.classify(h.url);
      const target = c.sheetId ? wb.getSheetBySheetId(c.sheetId)?.getSheetName() : undefined;
      const br = L.brokenInternal([{ url: h.url }], ids)[0];
      out.push({
        sheet: ws.getSheetName(),
        sheetId: ws.getSheetId(),
        row: h.row,
        col: h.column,
        a1: `${colName(h.column)}${h.row + 1}`,
        text: h.label ?? '',
        url: h.url,
        kind: c.kind,
        label:
          c.kind === 'web' || c.kind === 'mail' || c.kind === 'tel'
            ? h.url
            : `${target ?? '?'}${c.range ? '!' + c.range : ''}`,
        broken: br?.reason,
      });
    }
  }
  return out;
}
export function goToCell(e: Engine, sheetId: string, row: number, col: number) {
  const wb = wbOf(e);
  const ws = wb?.getSheetBySheetId(sheetId);
  if (!wb || !ws) return;
  wb.setActiveSheet(ws);
  ws.getRange(row, col).activate();
}
export function removeLink(e: Engine, sheetId: string, row: number, col: number): Out {
  const ws = wbOf(e)?.getSheetBySheetId(sheetId);
  if (!ws) return fail('Sheet not found');
  const done = (ws.getRange(row, col) as unknown as FR).cancelHyperLink();
  return done ? ok('Link removed (the text stays)') : fail('No link there');
}
export function followInternal(e: Engine, url: string): Out {
  const c = L.classify(url);
  if (!c.sheetId) return fail('Not a link inside this workbook');
  const wb = wbOf(e);
  const ws = wb?.getSheetBySheetId(c.sheetId);
  if (!wb || !ws) return fail('That sheet no longer exists');
  wb.setActiveSheet(ws);
  if (c.range && c.kind === 'range') ws.getRange(c.range).activate();
  return ok('Moved');
}
// ---- web data
export interface Connection {
  id: string;
  name: string;
  url: string;
  dest: string;
  rows?: number;
  cols?: number;
}
export function listConnections(): Connection[] {
  return Q.getQueries()
    .filter((q) => q.source.kind === 'url')
    .map((q) => ({
      id: q.id,
      name: q.name,
      url: (q.source as { url: string }).url,
      dest: `${q.destSheet}!${q.anchor}`,
      rows: q.last ? q.last.rows - 1 : undefined,
      cols: q.last?.cols,
    }));
}
export async function addWebData(
  e: Engine,
  o: { url: string; name: string; header: boolean; dest?: string },
): Promise<Out> {
  const u = L.checkWebUrl(o.url);
  if (!u.ok) return fail(u.reason);
  const f = await Q.fetchText(u.url);
  if (f.error) return fail(f.error);
  const s = Q.saveQuery(e, {
    name: o.name || L.hostOf(u.url) || 'Web data',
    source: { kind: 'url', url: u.url },
    header: o.header,
    steps: [],
    dest: o.dest || undefined,
  });
  if (!s.ok || !s.id) return s;
  const def = Q.getQuery(s.id)!;
  const r = Q.loadToSheet(e, def, f.text);
  if (!r.ok) {
    Q.removeQuery(e, def.id);
    return r;
  }
  return ok(r.message, { id: def.id });
}
export async function refreshConnection(e: Engine, id: string): Promise<Out> {
  const d = Q.getQuery(id);
  if (!d || d.source.kind !== 'url') return fail('Connection not found');
  const f = await Q.fetchText(d.source.url);
  if (f.error) return fail(f.error);
  return Q.loadToSheet(e, d, f.text);
}
export const removeConnection = (e: Engine, id: string, clear: boolean) => Q.removeQuery(e, id, clear);
export const refreshAllConnections = (e: Engine) => Q.refreshAllQueries(e);
export function install(w: Record<string, unknown>, e: () => Engine) {
  w.dracoLinks = {
    insert: (s: InsertSpec) => insertLink(e(), s),
    list: () => listLinks(e()),
    remove: (sid: string, r: number, c: number) => removeLink(e(), sid, r, c),
    follow: (u: string) => followInternal(e(), u),
    addWeb: (o: Parameters<typeof addWebData>[1]) => addWebData(e(), o),
    connections: listConnections,
    refresh: (id: string) => refreshConnection(e(), id),
    refreshAll: () => refreshAllConnections(e()),
    removeConn: (id: string, clear = false) => removeConnection(e(), id, clear),
  };
}

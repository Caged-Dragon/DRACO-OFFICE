// Workbook persistence: IndexedDB (always, offline-first) + Supabase (when signed in).
import { supabase } from './supabase';

export interface WorkbookMeta {
  id: string;
  title: string;
  updatedAt: string;
  source: 'local' | 'cloud';
}
type Snapshot = Record<string, unknown>;

const DB = 'draco-sheets';
const STORE = 'workbooks';

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('versions'))
        d.createObjectStore('versions', { keyPath: 'key', autoIncrement: true }).createIndex('wb', 'wbId');
      if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = fn(d.transaction(store, mode).objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

interface LocalRow {
  id: string;
  title: string;
  data: Snapshot;
  updatedAt: string;
  cloud?: boolean;
}

export const newId = () => crypto.randomUUID();

export async function saveLocal(id: string, title: string, data: Snapshot, cloud = false) {
  await tx('readwrite', (s) =>
    s.put({ id, title, data, updatedAt: new Date().toISOString(), cloud } satisfies LocalRow),
  );
}
export async function loadLocal(id: string): Promise<{ title: string; data: Snapshot } | null> {
  const r = await tx<LocalRow | undefined>('readonly', (s) => s.get(id));
  return r ? { title: r.title, data: r.data } : null;
}
export async function listLocal(): Promise<WorkbookMeta[]> {
  const rows = await tx<LocalRow[]>('readonly', (s) => s.getAll());
  return rows
    .filter((r) => !r.cloud)
    .map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt, source: 'local' as const }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function deleteLocal(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

export async function saveCloud(id: string, title: string, data: Snapshot) {
  if (!supabase) throw new Error('Cloud not configured');
  const { error } = await supabase.from('sheets_workbooks').upsert({ id, title, data });
  if (error) throw error;
}
export async function loadCloud(id: string): Promise<{ title: string; data: Snapshot } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('sheets_workbooks').select('title,data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as { title: string; data: Snapshot } | null;
}
export async function listCloud(): Promise<WorkbookMeta[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sheets_workbooks')
    .select('id,title,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    updatedAt: r.updated_at as string,
    source: 'cloud' as const,
  }));
}
export async function deleteCloud(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('sheets_workbooks').delete().eq('id', id);
  if (error) throw error;
}
export async function snapshotCloudVersion(id: string, data: Snapshot, label?: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('sheets_workbook_versions')
    .insert({ workbook_id: id, data, label: label ?? null });
  if (error) throw error;
}

/* ---------- version history (v85) ---------- */
export interface VersionRow {
  key: number;
  wbId: string;
  at: string;
  label: string;
  kind: 'auto' | 'manual';
  hash: string;
  data: Snapshot;
}
export type VersionMeta = Omit<VersionRow, 'data'>;
export async function addVersion(
  wbId: string,
  data: Snapshot,
  label: string,
  kind: 'auto' | 'manual',
  hash: string,
): Promise<number> {
  const row = { wbId, at: new Date().toISOString(), label, kind, hash, data };
  return tx<IDBValidKey>('readwrite', (s) => s.add(row), 'versions').then((k) => k as number);
}
export async function listVersions(wbId: string): Promise<VersionMeta[]> {
  const rows = await tx<VersionRow[]>('readonly', (s) => s.index('wb').getAll(wbId), 'versions');
  return rows.map(({ data: _d, ...m }) => m).sort((a, b) => b.at.localeCompare(a.at));
}
export const getVersion = (key: number) => tx<VersionRow | undefined>('readonly', (s) => s.get(key), 'versions');
export const deleteVersion = (key: number) => tx('readwrite', (s) => s.delete(key), 'versions');
export async function deleteVersionsOf(wbId: string) {
  for (const v of await listVersions(wbId)) await deleteVersion(v.key);
}

/* ---------- drafts / crash recovery (v86) ---------- */
export interface DraftRow {
  id: string;
  title: string;
  at: string;
  cloud: boolean;
  data: Snapshot;
}
export const saveDraft = (id: string, title: string, data: Snapshot, cloud: boolean) =>
  tx('readwrite', (s) => s.put({ id, title, data, cloud, at: new Date().toISOString() } satisfies DraftRow), 'drafts');
export const loadDraft = (id: string) => tx<DraftRow | undefined>('readonly', (s) => s.get(id), 'drafts');
export const clearDraft = (id: string) => tx('readwrite', (s) => s.delete(id), 'drafts');
export async function localUpdatedAt(id: string): Promise<string | null> {
  const r = await tx<LocalRow | undefined>('readonly', (s) => s.get(id));
  return r ? r.updatedAt : null;
}

/* ---- v1.0.0 server-enforced share links (sheets_shares + token-gated RPCs) ---- */
export type ShareRole = 'view' | 'comment' | 'edit';
export interface ShareRow {
  id: string;
  token: string;
  role: ShareRole;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}
export async function createCloudShare(workbookId: string, role: ShareRole, expiresInDays?: number): Promise<ShareRow> {
  if (!supabase) throw new Error('Cloud not configured');
  const expires_at = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null;
  const { data, error } = await supabase
    .from('sheets_shares')
    .insert({ workbook_id: workbookId, role, expires_at })
    .select('id,token,role,expires_at,revoked,created_at')
    .single();
  if (error) throw error;
  return data as ShareRow;
}
export async function listCloudShares(workbookId: string): Promise<ShareRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sheets_shares')
    .select('id,token,role,expires_at,revoked,created_at')
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShareRow[];
}
export async function revokeCloudShare(id: string) {
  if (!supabase) throw new Error('Cloud not configured');
  const { error } = await supabase.from('sheets_shares').update({ revoked: true }).eq('id', id);
  if (error) throw error;
}
export async function openCloudShare(
  token: string,
): Promise<{ title: string; data: Snapshot; role: ShareRole } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('sheets_open_shared', { p_token: token });
  if (error) throw error;
  const row = (data as Array<{ title: string; data: Snapshot; role: ShareRole }> | null)?.[0];
  return row ?? null;
}
export async function saveCloudShare(token: string, data: Snapshot): Promise<boolean> {
  if (!supabase) return false;
  const { data: ok, error } = await supabase.rpc('sheets_save_shared', { p_token: token, p_data: data });
  if (error) throw error;
  return ok === true;
}
export const cloudShareUrl = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/#cloud=${token}`;
export const cloudTokenFromHash = (hash: string): string | null => {
  const m = /(?:^#|&)cloud=([a-f0-9]{32,80})/.exec(hash);
  return m ? m[1] : null;
};

/** Set by App: id of the open workbook when it is saved to the cloud and the user is signed in. */
export const cloudCtx: { id: string | null } = { id: null };

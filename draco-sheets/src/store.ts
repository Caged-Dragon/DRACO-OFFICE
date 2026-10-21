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
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

interface LocalRow { id: string; title: string; data: Snapshot; updatedAt: string; cloud?: boolean }

export const newId = () => crypto.randomUUID();

export async function saveLocal(id: string, title: string, data: Snapshot, cloud = false) {
  await tx('readwrite', (s) => s.put({ id, title, data, updatedAt: new Date().toISOString(), cloud } satisfies LocalRow));
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
  const { error } = await supabase.from('workbooks').upsert({ id, title, data });
  if (error) throw error;
}
export async function loadCloud(id: string): Promise<{ title: string; data: Snapshot } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('workbooks').select('title,data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as { title: string; data: Snapshot } | null;
}
export async function listCloud(): Promise<WorkbookMeta[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('workbooks')
    .select('id,title,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, title: r.title as string, updatedAt: r.updated_at as string, source: 'cloud' as const }));
}
export async function deleteCloud(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('workbooks').delete().eq('id', id);
  if (error) throw error;
}
export async function snapshotCloudVersion(id: string, data: Snapshot, label?: string) {
  if (!supabase) return;
  const { error } = await supabase.from('workbook_versions').insert({ workbook_id: id, data, label: label ?? null });
  if (error) throw error;
}

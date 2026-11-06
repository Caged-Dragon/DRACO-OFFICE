// Client for the bulk worker (v97). Falls back to the main thread when Workers are unavailable (e.g. Node tests).
import { runBulk, type BulkReq, type BulkRes } from './bulkCore';
let worker: Worker | null = null; let seq = 0; const pending = new Map<number, { ok: (r: BulkRes) => void; err: (m: string) => void }>();
export const stats = { calls: 0, viaWorker: 0 };
function get(): Worker | null {
  if (worker) return worker; if (typeof Worker === 'undefined') return null;
  try { worker = new Worker(new URL('./bulk.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; res?: BulkRes; error?: string }>) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error ? p.err(e.data.error) : p.ok(e.data.res!); };
    worker.onerror = () => { for (const p of pending.values()) p.err('Background worker failed'); pending.clear(); worker?.terminate(); worker = null; };
  } catch { worker = null; } return worker;
}
export function bulk<T extends BulkRes>(req: BulkReq): Promise<T> {
  stats.calls++; const w = get();
  if (!w) return Promise.resolve(runBulk(req) as T);
  stats.viaWorker++;
  return new Promise<T>((ok, err) => { const id = ++seq; pending.set(id, { ok: ok as (r: BulkRes) => void, err: (m) => { try { ok(runBulk(req) as T); } catch { err(new Error(m)); } } }); w.postMessage({ id, req }); });
}

/// <reference lib="webworker" />
import { runBulk, type BulkReq } from './bulkCore';
self.onmessage = (e: MessageEvent<{ id: number; req: BulkReq }>) => {
  try { (self as unknown as Worker).postMessage({ id: e.data.id, res: runBulk(e.data.req) }); } catch (err) { (self as unknown as Worker).postMessage({ id: e.data.id, error: (err as Error).message }); }
};

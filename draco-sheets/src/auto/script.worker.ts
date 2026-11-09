// Worker that runs user scripts; every workbook call is a message to the page. The page can terminate it on timeout.
import { runScript } from './script';
type In = { type: 'run'; code: string } | { type: 'result'; id: number; ok: boolean; value?: unknown; error?: string };
let nextId = 1;
const pending = new Map<number, { res: (v: unknown) => void; rej: (e: Error) => void }>();
const post = (m: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);
const call = (method: string, args: unknown[]) =>
  new Promise<unknown>((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    post({ type: 'call', id, method, args });
  });
self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data;
  if (m.type === 'result') {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.res(m.value);
    else p.rej(new Error(m.error ?? 'Failed'));
    return;
  }
  try {
    const v = await runScript(m.code, call, (kind, text) => post({ type: 'log', kind, text }));
    post({ type: 'done', value: v === undefined ? undefined : JSON.parse(JSON.stringify(v ?? null)) });
  } catch (err) {
    post({ type: 'fail', error: (err as Error).message ?? String(err) });
  }
};

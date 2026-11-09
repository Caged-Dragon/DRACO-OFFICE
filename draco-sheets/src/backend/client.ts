/** Client for the optional Python backend (backend/). Everything here is a no-op when VITE_API_URL is not set. */
const BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? '').replace(/\/+$/, '');
export const backendConfigured = (): boolean => !!BASE;

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok)
    throw new Error(((await r.json().catch(() => ({}))) as { detail?: string }).detail ?? `Server error ${r.status}`);
  return r.json() as Promise<T>;
}
export async function health(): Promise<{ ok: boolean; convert: boolean } | null> {
  if (!BASE) return null;
  try {
    const r = await fetch(BASE + '/health', { signal: AbortSignal.timeout(4000) });
    return r.ok ? ((await r.json()) as { ok: boolean; convert: boolean }) : null;
  } catch {
    return null;
  }
}
export const stats = {
  describe: (values: number[]) => post<Record<string, number | null>>('/v1/stats/describe', { values }),
  regression: (x: number[], y: number[]) => post<Record<string, number>>('/v1/stats/regression', { x, y }),
  ttest: (a: number[], b: number[], kind: 'welch' | 'equal' | 'paired' = 'welch') =>
    post<Record<string, number | string>>('/v1/stats/ttest', { a, b, kind }),
  anova: (groups: number[][]) => post<Record<string, number>>('/v1/stats/anova', { groups }),
  correlation: (columns: number[][]) => post<{ matrix: number[][] }>('/v1/stats/correlation', { columns }),
};
/** Convert a workbook file on the server (xlsx, ods, csv or pdf). Returns the converted bytes. */
export async function convertFile(file: Blob, filename: string, to: 'xlsx' | 'ods' | 'csv' | 'pdf'): Promise<Blob> {
  const fd = new FormData();
  fd.append('file', file, filename);
  const r = await fetch(`${BASE}/v1/convert?to=${to}`, { method: 'POST', body: fd });
  if (!r.ok)
    throw new Error(((await r.json().catch(() => ({}))) as { detail?: string }).detail ?? `Server error ${r.status}`);
  return r.blob();
}

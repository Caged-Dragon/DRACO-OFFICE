export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const f1 = (n: number) => (Math.round(n * 100) / 100).toString();
export const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

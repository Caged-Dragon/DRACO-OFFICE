// Draco-owned workbook data (pivots, queries, ...) rides inside the saved snapshot as extra "resources" the engine ignores.
export interface Provider {
  get: () => unknown;
  set: (v: unknown) => void;
  reset: () => void;
}
type Res = Array<{ name: string; data: string }>;
const providers = new Map<string, Provider>();
export const registerResource = (name: string, p: Provider) => {
  providers.set(name, p);
};
export function addResources(snap: { resources?: Res }): void {
  snap.resources = (snap.resources ?? []).filter((r) => !providers.has(r.name));
  for (const [name, p] of providers) {
    const v = p.get();
    if (v !== undefined && v !== null && !(Array.isArray(v) && !v.length))
      snap.resources.push({ name, data: JSON.stringify(v) });
  }
}
export function loadResources(snap: { resources?: Res } | undefined): void {
  for (const [name, p] of providers) {
    const r = snap?.resources?.find((x) => x.name === name);
    if (!r) {
      p.reset();
      continue;
    }
    try {
      p.set(JSON.parse(r.data));
    } catch {
      p.reset();
    }
  }
}

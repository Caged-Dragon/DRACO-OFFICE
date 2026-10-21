export const TAG_PREFIX = "draco-slides/v";

export interface LatestTag {
  /** Full Git tag, e.g. draco-slides/v0.3.0 */
  tag: string;
  /** Display label, e.g. v0.3.0 */
  label: string;
}

/** Parses draco-slides/vX.Y.Z (numeric parts, so v1.01.0 sorts above v1.0.0 and v0.99.0). */
export function parseVersion(tag: string): number[] | null {
  if (!tag.startsWith(TAG_PREFIX)) return null;
  const parts = tag.slice(TAG_PREFIX.length).split(".");
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.map(Number);
}

export function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function pickLatestTag(names: string[]): LatestTag | null {
  let best: { tag: string; v: number[] } | null = null;
  for (const tag of names) {
    const v = parseVersion(tag);
    if (v && (!best || compareVersions(v, best.v) > 0)) best = { tag, v };
  }
  return best ? { tag: best.tag, label: best.tag.slice(TAG_PREFIX.length - 1) } : null;
}

/** True when `tag` is newer than a plain build version such as "0.3.0". */
export function isNewer(tag: string, buildVersion: string): boolean {
  const a = parseVersion(tag);
  const b = parseVersion(`${TAG_PREFIX}${buildVersion}`);
  return !!a && !!b && compareVersions(a, b) > 0;
}

export function isValidRepo(repo: string | undefined): repo is string {
  return !!repo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

export function releaseUrl(repo: string, tag?: string): string {
  return tag ? `https://github.com/${repo}/releases/tag/${tag}` : `https://github.com/${repo}/releases`;
}

/**
 * Reads Draco Slides tags from a public GitHub repo (no token; never put a token in the browser).
 * Uses the matching-refs endpoint so tags from draco-docs / draco-sheets cannot crowd the result.
 */
export async function fetchLatestTag(repo: string, signal?: AbortSignal): Promise<LatestTag | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/git/matching-refs/tags/${TAG_PREFIX}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response from GitHub");
  const names = data.map((d) =>
    typeof (d as { ref?: unknown })?.ref === "string" ? (d as { ref: string }).ref.replace(/^refs\/tags\//, "") : "",
  );
  return pickLatestTag(names);
}

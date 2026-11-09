// Share links (v90): role model, room codes, and self-contained snapshot links.
export type Role = 'view' | 'comment' | 'edit';
export const ROLES: Role[] = ['view', 'comment', 'edit'];
export const canEdit = (r: Role) => r === 'edit';
export const canComment = (r: Role) => r === 'edit' || r === 'comment';
export const roleLabel = (r: Role) => ({ view: 'Can view', comment: 'Can comment', edit: 'Can edit' })[r];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode(len = 6): string {
  const b = crypto.getRandomValues(new Uint8Array(len));
  return [...b].map((x) => ALPHA[x % ALPHA.length]).join('');
}
export const validRoom = (s: string) => new RegExp(`^[${ALPHA}]{6}$`).test(s);
/** Accepts a bare code or a link containing ?room=CODE (and optional &role=). */
export function parseRoomInput(text: string): { room: string; role?: Role } | null {
  const t = text.trim();
  const code = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (validRoom(code) && !/[?=/]/.test(t)) return { room: code };
  try {
    const u = new URL(t, 'https://x.invalid/');
    const room = (u.searchParams.get('room') ?? '').toUpperCase();
    const role = u.searchParams.get('role') as Role | null;
    if (validRoom(room)) return { room, role: role && ROLES.includes(role) ? role : undefined };
  } catch {
    /* not a url */
  }
  return null;
}
export const roomLink = (origin: string, room: string, role: Role) =>
  `${origin.replace(/\/$/, '')}/?room=${room}&role=${role}`;

const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const w = stream.writable.getWriter();
  w.write(data as BufferSource)
    .then(() => w.close())
    .catch(() => {
      /* surfaced by the reader */
    });
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
export const MAX_LINK_CHARS = 180_000;
export interface SharePayload {
  v: 1;
  title: string;
  role: Role;
  snap: Record<string, unknown>;
}
export async function encodeShare(p: {
  title: string;
  role: Role;
  snap: Record<string, unknown>;
}): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const json = JSON.stringify({ v: 1, title: p.title, role: p.role, snap: p.snap } satisfies SharePayload);
  const z = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  const token = b64(z);
  return token.length > MAX_LINK_CHARS
    ? {
        ok: false,
        reason: `This workbook is too large for a link (${Math.round(token.length / 1024)} KB, limit ${Math.round(MAX_LINK_CHARS / 1024)} KB). Use a live session or download a file instead.`,
      }
    : { ok: true, token };
}
export async function decodeShare(token: string): Promise<SharePayload | null> {
  try {
    const raw = await pipe(unb64(token.trim()), new DecompressionStream('deflate-raw'));
    const p = JSON.parse(new TextDecoder().decode(raw)) as SharePayload;
    if (p.v !== 1 || !p.snap || typeof p.snap !== 'object' || !ROLES.includes(p.role)) return null;
    return p;
  } catch {
    return null;
  }
}
export const shareLink = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/#share=${token}`;
export function tokenFromHash(hash: string): string | null {
  const m = /(?:^#|&)share=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? m[1] : null;
}

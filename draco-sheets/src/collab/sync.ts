// Live co-editing protocol (v89): messages, session logic, presence, transports. Pure apart from the transports.
import type { Role } from './share';
export interface Sel {
  r: number;
  c: number;
  r2: number;
  c2: number;
}
export type Msg =
  | { t: 'hello'; from: string; name: string; color: string; joinedAt: number; host: boolean; want?: Role }
  | {
      t: 'presence';
      from: string;
      name: string;
      color: string;
      joinedAt: number;
      host: boolean;
      sheetId: string;
      sel: Sel | null;
    }
  | { t: 'need'; from: string }
  | { t: 'snapshot'; from: string; to: string; title: string; id: string; snap: unknown }
  | { t: 'op'; from: string; id: string; params: unknown }
  | { t: 'res'; from: string; name: string; data: unknown }
  | { t: 'role'; from: string; to: string; role: Role }
  | { t: 'bye'; from: string };
export interface Transport {
  send(m: Msg): void;
  subscribe(cb: (m: Msg) => void): () => void;
  close(): void;
}
export interface Peer {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
  host: boolean;
  sheetId?: string;
  sel?: Sel | null;
  lastSeen: number;
  role: Role;
}
export interface Hooks {
  applyOp(id: string, params: unknown, from: Peer | undefined): void;
  getSnapshot(): { title: string; id: string; snap: unknown } | null;
  onSnapshot(s: { title: string; id: string; snap: unknown }): void;
  onPeers(peers: Peer[]): void;
  onResource(name: string, data: unknown, from: string): void;
  onRole(role: Role): void;
  now?(): number;
}
export const HEARTBEAT_MS = 5000,
  PEER_TTL_MS = 15000;
/** Which mutations are shared with peers. Formula results and other local-only work are excluded. */
export function shouldBroadcast(id: string, options?: Record<string, unknown>): boolean {
  if (
    options &&
    (options.onlyLocal || options.fromCollab || options.fromChangeset || options.fromSync || options.fromFormula)
  )
    return false;
  if (!id.startsWith('sheet.mutation.')) return false;
  return !/toggle-note-popup|set-selections|scroll|zoom|set-worksheet-active|protection|permission|mark-dirty|mutation\.empty|mutation\.ts$/.test(
    id,
  );
}
const RANK: Record<Role, number> = { view: 0, comment: 1, edit: 2 };
const lower = (a: Role, b?: Role): Role => (b && RANK[b] < RANK[a] ? b : a);
export class Session {
  readonly peers = new Map<string, Peer>();
  private unsub: () => void;
  private hostSeen = false;
  private role: Role;
  private guestRoles = new Map<string, Role>();
  private lastPresence: { sheetId: string; sel: Sel | null } = { sheetId: '', sel: null };
  private joined = 0;
  private gotSnapshot = false;
  constructor(
    private tr: Transport,
    readonly me: { id: string; name: string; color: string; host: boolean },
    private hooks: Hooks,
    private opts: { defaultRole: Role } = { defaultRole: 'edit' },
  ) {
    this.role = me.host ? 'edit' : opts.defaultRole;
    this.unsub = tr.subscribe((m) => this.handle(m));
  }
  private now() {
    return this.hooks.now ? this.hooks.now() : Date.now();
  }
  get myRole() {
    return this.role;
  }
  start(wantSnapshot: boolean, want?: Role) {
    this.joined = this.now();
    this.tr.send({
      t: 'hello',
      from: this.me.id,
      name: this.me.name,
      color: this.me.color,
      joinedAt: this.joined,
      host: this.me.host,
      want,
    });
    if (wantSnapshot) this.tr.send({ t: 'need', from: this.me.id });
  }
  private presenceMsg(): Msg {
    return {
      t: 'presence',
      from: this.me.id,
      name: this.me.name,
      color: this.me.color,
      joinedAt: this.joined,
      host: this.me.host,
      sheetId: this.lastPresence.sheetId,
      sel: this.lastPresence.sel,
    };
  }
  setPresence(sheetId: string, sel: Sel | null) {
    this.lastPresence = { sheetId, sel };
    this.tr.send(this.presenceMsg());
  }
  heartbeat() {
    this.tr.send(this.presenceMsg());
    this.prune();
  }
  prune() {
    const t = this.now();
    let ch = false;
    for (const [id, p] of this.peers)
      if (t - p.lastSeen > PEER_TTL_MS) {
        this.peers.delete(id);
        ch = true;
      }
    if (ch) this.emit();
  }
  private emit() {
    this.hooks.onPeers([...this.peers.values()].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)));
  }
  canSend(): boolean {
    return this.role === 'edit';
  }
  sendOp(id: string, params: unknown): boolean {
    if (!this.canSend()) return false;
    this.tr.send({ t: 'op', from: this.me.id, id, params });
    return true;
  }
  sendResource(name: string, data: unknown) {
    this.tr.send({ t: 'res', from: this.me.id, name, data });
  }
  setGuestRole(peerId: string, role: Role) {
    if (!this.me.host) return;
    this.guestRoles.set(peerId, role);
    const p = this.peers.get(peerId);
    if (p) p.role = role;
    this.tr.send({ t: 'role', from: this.me.id, to: peerId, role });
    this.emit();
  }
  setDefaultRole(role: Role) {
    this.opts.defaultRole = role;
  }
  leave() {
    this.tr.send({ t: 'bye', from: this.me.id });
    this.unsub();
    this.tr.close();
    this.peers.clear();
  }
  private touch(m: {
    from: string;
    name?: string;
    color?: string;
    joinedAt?: number;
    host?: boolean;
    sheetId?: string;
    sel?: Sel | null;
  }): Peer {
    let p = this.peers.get(m.from);
    const isNew = !p;
    const role = this.guestRoles.get(m.from) ?? (m.host ? 'edit' : this.opts.defaultRole);
    if (!p)
      p = {
        id: m.from,
        name: m.name ?? 'Guest',
        color: m.color ?? '#888',
        joinedAt: m.joinedAt ?? this.now(),
        host: !!m.host,
        lastSeen: this.now(),
        role,
      };
    else {
      if (m.name) p.name = m.name;
      if (m.color) p.color = m.color;
      if (m.joinedAt !== undefined) p.joinedAt = m.joinedAt;
      if (m.host !== undefined) p.host = m.host;
    }
    if (m.sheetId !== undefined) p.sheetId = m.sheetId;
    if (m.sel !== undefined) p.sel = m.sel;
    p.lastSeen = this.now();
    if (m.host) this.hostSeen = true;
    this.peers.set(m.from, p);
    if (isNew) this.emit();
    return p;
  }
  private oldestIsMe(): boolean {
    for (const p of this.peers.values())
      if (p.joinedAt < this.joined || (p.joinedAt === this.joined && p.id < this.me.id)) return false;
    return true;
  }
  handle(m: Msg) {
    if (m.from === this.me.id) return;
    switch (m.t) {
      case 'hello': {
        const p = this.touch(m);
        this.tr.send(this.presenceMsg());
        if (this.me.host) {
          const r = this.guestRoles.get(m.from) ?? lower(this.opts.defaultRole, m.want);
          if (!m.host) {
            p.role = r;
            this.guestRoles.set(m.from, r);
            this.tr.send({ t: 'role', from: this.me.id, to: m.from, role: r });
          }
        }
        this.emit();
        return;
      }
      case 'presence': {
        this.touch(m);
        this.emit();
        return;
      }
      case 'need': {
        const snap = this.me.host || (!this.hostSeen && this.oldestIsMe()) ? this.hooks.getSnapshot() : null;
        if (snap) this.tr.send({ t: 'snapshot', from: this.me.id, to: m.from, ...snap });
        return;
      }
      case 'snapshot': {
        if (m.to !== this.me.id || this.gotSnapshot) return;
        this.gotSnapshot = true;
        this.hooks.onSnapshot({ title: m.title, id: m.id, snap: m.snap });
        return;
      }
      case 'op': {
        const p = this.peers.get(m.from);
        const sender = p ? (this.me.host ? (this.guestRoles.get(m.from) ?? p.role) : p.role) : this.opts.defaultRole;
        if (this.me.host && sender !== 'edit') return;
        this.hooks.applyOp(m.id, m.params, p);
        return;
      }
      case 'res': {
        this.hooks.onResource(m.name, m.data, m.from);
        return;
      }
      case 'role': {
        if (m.to === this.me.id) {
          this.role = m.role;
          this.hooks.onRole(m.role);
        }
        return;
      }
      case 'bye': {
        if (this.peers.delete(m.from)) this.emit();
        return;
      }
    }
  }
}
export class MemoryHub {
  private subs = new Set<(m: Msg) => void>();
  create(): Transport {
    let mine: ((m: Msg) => void) | null = null;
    const hub = this;
    return {
      send(m) {
        for (const s of hub.subs) if (s !== mine) queueMicrotask(() => s(JSON.parse(JSON.stringify(m)) as Msg));
      },
      subscribe(cb) {
        mine = cb;
        hub.subs.add(cb);
        return () => {
          hub.subs.delete(cb);
        };
      },
      close() {
        if (mine) hub.subs.delete(mine);
      },
    };
  }
}
export function broadcastTransport(room: string): Transport {
  const ch = new BroadcastChannel(`draco-room-${room}`);
  const handlers = new Set<(m: Msg) => void>();
  ch.onmessage = (e) => {
    for (const h of handlers) h(e.data as Msg);
  };
  return {
    send: (m) => ch.postMessage(JSON.parse(JSON.stringify(m))),
    subscribe: (cb) => {
      handlers.add(cb);
      return () => handlers.delete(cb);
    },
    close: () => {
      handlers.clear();
      ch.close();
    },
  };
}
type SbClient = {
  channel(
    name: string,
    opts?: unknown,
  ): {
    on(type: string, filter: unknown, cb: (p: { payload: Msg }) => void): unknown;
    subscribe(cb?: (status: string) => void): unknown;
    send(m: unknown): unknown;
    unsubscribe(): unknown;
  };
};
/** Supabase Realtime broadcast transport (used when signed in; needs the project's Realtime enabled). */
export function supabaseTransport(client: SbClient, room: string): Transport {
  const ch = client.channel(`draco-room-${room}`, { config: { broadcast: { self: false } } });
  const handlers = new Set<(m: Msg) => void>();
  const queue: Msg[] = [];
  let ready = false;
  ch.on('broadcast', { event: 'm' }, (p) => {
    for (const h of handlers) h(p.payload);
  });
  ch.subscribe((s) => {
    if (s === 'SUBSCRIBED') {
      ready = true;
      for (const m of queue.splice(0)) void ch.send({ type: 'broadcast', event: 'm', payload: m });
    }
  });
  return {
    send: (m) => {
      if (ready) void ch.send({ type: 'broadcast', event: 'm', payload: m });
      else queue.push(m);
    },
    subscribe: (cb) => {
      handlers.add(cb);
      return () => handlers.delete(cb);
    },
    close: () => {
      handlers.clear();
      void ch.unsubscribe();
    },
  };
}

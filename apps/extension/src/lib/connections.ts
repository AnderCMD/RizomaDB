import type { Connection, DriverPlugin } from "@rizomadb/driver-api";
import { openProxyTunnel, type ProxySettings } from "@rizomadb/network";
import { guardConnection, parseProfile, redactString, resolveConfig, ruleFor, saveSecrets, type AuditLog, type ConnectionProfile, type EffectivePolicy, type SecretStore } from "@rizomadb/core";

export interface Memento {
  get<T>(key: string, fallback: T): T;
  update(key: string, value: unknown): PromiseLike<void> | Promise<void>;
}

export interface SshSettings { host: string; port: number; username: string; password?: string; keyPath?: string; passphrase?: string }
export interface OpenTunnel { localPort: number; close(): Promise<void> }
/** Provided by the host application (VS Code) so prompts for unknown host keys stay out of this module. */
export type TunnelFactory = (ssh: SshSettings, target: { host: string; port: number }) => Promise<OpenTunnel>;

export type DriverRegistry = Record<string, () => Promise<DriverPlugin>>;

const KEY = "rizomadb.profiles";
/** A server that never answers must not leave the connection "connecting" forever (every later request would wait on it). */
const CONNECT_TIMEOUT_MS = 45_000;

/** Rejects after `ms`; if the work still finishes later, `onLate` gets the result so it can be closed instead of leaking. */
function within<T>(ms: number, what: string, work: Promise<T>, onLate: (late: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { done = true; reject(new Error(`Timed out after ${ms / 1000} s connecting to ${what}.`)); }, ms);
    work.then((v) => { clearTimeout(timer); if (done) onLate(v); else { done = true; resolve(v); } }, (e) => { clearTimeout(timer); if (!done) { done = true; reject(e); } });
  });
}

export type CatalogProfile = ConnectionProfile & { source: string };

export class ConnectionManager {
  private catalog: CatalogProfile[] = [];
  private open = new Map<string, Promise<Connection>>();
  private tunnels = new Map<string, OpenTunnel>();
  /** Secret values seen while connecting, per connection, so messages can be scrubbed. */
  private known = new Map<string, string[]>();
  private listeners = new Set<() => void>();
  /** Connections whose driver has answered; one in `open` but not here is still connecting. */
  private ready = new Set<string>();
  private lastUsed = new Map<string, number>();
  private sweeper: NodeJS.Timeout | undefined;
  /** Close a connection nobody has used for this long (0 = never). */
  private idleMs = 0;
  /** The host says which connection is running a statement right now: never closed while busy. */
  isBusy: (id: string) => boolean = () => false;
  private closedListeners = new Set<(id: string, reason: "idle") => void>();
  /** The built-in default: connections in `prod` are read-only unless they were switched to editable on purpose. */
  prodReadOnly = true;
  /** How long a driver or tunnel may take to answer before the attempt is abandoned. */
  connectTimeoutMs = CONNECT_TIMEOUT_MS;
  private parsed: { raw: unknown[]; out: ConnectionProfile[] } | undefined;

  constructor(
    private state: Memento, private secrets: SecretStore, private registry: DriverRegistry,
    private getPolicy: () => EffectivePolicy, private env: Record<string, string | undefined> = process.env, private openSsh?: TunnelFactory,
    private hooks: { audit?: AuditLog; approve?: (profileName: string, reason: string, statement: string) => Promise<boolean>; promptSecret?: (profile: ConnectionProfile, key: string) => Promise<string | undefined> } = {},
  ) {}

  onChange(fn: () => void) { this.listeners.add(fn); return { dispose: () => this.listeners.delete(fn) }; }
  private fire() { this.listeners.forEach((f) => f()); }

  driverIds() { return Object.keys(this.registry); }
  loadDriver(id: string) {
    const f = this.registry[id];
    if (!f) throw new Error(`Unknown driver: ${id}`);
    return f();
  }

  /** Shared (team/project) connections: read-only here, secrets still belong to each user. */
  setCatalog(entries: CatalogProfile[]) { this.catalog = entries; this.fire(); }
  isShared(id: string) { return this.catalog.some((c) => c.id === id); }
  sourceOf(id: string) { return this.catalog.find((c) => c.id === id)?.source; }

  private userProfiles(): ConnectionProfile[] {
    const raw = this.state.get<unknown[]>(KEY, []);
    // The tree, status bar and webviews ask for the profiles constantly: parse the stored list again only when it changed.
    if (this.parsed?.raw === raw) return this.parsed.out;
    const out: ConnectionProfile[] = [];
    for (const r of raw) { try { out.push(parseProfile(r)); } catch { /* ignore invalid stored profile */ } }
    this.parsed = { raw, out };
    return out;
  }
  list(): ConnectionProfile[] {
    const shared = this.catalog.map(({ source: _s, ...p }) => { void _s; return p as ConnectionProfile; });
    return [...shared, ...this.userProfiles().filter((u) => !this.isShared(u.id))];
  }
  get(id: string) { return this.list().find((p) => p.id === id); }

  async add(p: Omit<ConnectionProfile, "options" | "secretKeys"> & { values: Record<string, unknown>; secretKeys: string[] }) {
    const { values, ...rest } = p;
    const options = await saveSecrets(this.secrets, p.id, p.secretKeys, values);
    const profile = parseProfile({ ...rest, options });
    await this.state.update(KEY, [...this.userProfiles().filter((x) => x.id !== p.id), profile]);
    this.fire();
    return profile;
  }

  async update(id: string, patch: Partial<Pick<ConnectionProfile, "readOnly" | "writable" | "name" | "environment">>) {
    const cur = this.get(id);
    if (!cur) return;
    if (this.isShared(id)) throw new Error(`This connection is managed by the ${this.sourceOf(id)} catalog and cannot be changed here.`);
    await this.disconnect(id);
    await this.state.update(KEY, this.userProfiles().map((x) => (x.id === id ? { ...x, ...patch } : x)));
    this.fire();
  }

  async remove(id: string) {
    const p = this.get(id);
    await this.disconnect(id);
    if (p) for (const k of p.secretKeys) await this.secrets.delete(`rizomadb/${id}/${k}`);
    if (this.isShared(id)) { this.fire(); return; }
    await this.state.update(KEY, this.userProfiles().filter((x) => x.id !== id));
    this.fire();
  }

  /** The effective read-only flag: profile setting OR environment policy. */
  isReadOnly(p: ConnectionProfile) {
    return p.readOnly || this.policyLocked(p) || this.lockedByDefault(p);
  }
  /** A policy layer (team, project, user, custom environment) forbids writes here: the connection cannot be switched to editable. */
  policyLocked(p: ConnectionProfile) { return !!ruleFor(this.getPolicy(), p.environment).readOnly; }
  private lockedByDefault(p: ConnectionProfile) { return this.prodReadOnly && p.environment === "prod" && !p.writable; }
  /** Makes the connection editable (or read-only again). Returns false when a policy forbids writes. */
  async setEditable(id: string, editable: boolean): Promise<boolean> {
    const p = this.get(id); if (!p) return false;
    if (editable) {
      if (this.policyLocked(p)) return false;
      await this.update(id, { readOnly: false, writable: true });
    } else await this.update(id, { readOnly: true, writable: false });
    return true;
  }

  /** Replaces a saved connection with edited values, keeping its id, tags and read-only choice; secrets no longer used are deleted. */
  async replace(id: string, p: Omit<ConnectionProfile, "id" | "options" | "secretKeys" | "tags" | "readOnly" | "writable"> & { values: Record<string, unknown>; secretKeys: string[] }) {
    const cur = this.get(id);
    if (!cur) throw new Error(`Unknown connection: ${id}`);
    if (this.isShared(id)) throw new Error(`This connection is managed by the ${this.sourceOf(id)} catalog and cannot be changed here.`);
    await this.disconnect(id);
    for (const k of cur.secretKeys) if (!p.secretKeys.includes(k)) await this.secrets.delete(`rizomadb/${id}/${k}`);
    return this.add({ ...p, id, tags: cur.tags, readOnly: cur.readOnly, ...(p.environment === cur.environment && cur.writable ? { writable: true } : {}) });
  }

  /** The saved secret values of a connection, for the edit form. */
  async secretValues(id: string): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const k of this.get(id)?.secretKeys ?? []) { const v = await this.secrets.get(`rizomadb/${id}/${k}`); if (v !== undefined) out[k] = v; }
    return out;
  }

  isConnected(id: string) { return this.ready.has(id); }
  isConnecting(id: string) { return this.open.has(id) && !this.ready.has(id); }
  stateOf(id: string): "connected" | "connecting" | "disconnected" { return this.ready.has(id) ? "connected" : this.open.has(id) ? "connecting" : "disconnected"; }
  /** Marks the connection as in use, so the idle timer starts over. */
  touch(id: string) { if (this.open.has(id)) this.lastUsed.set(id, Date.now()); }
  lastUsedAt(id: string): number | undefined { return this.lastUsed.get(id); }
  onClosed(fn: (id: string, reason: "idle") => void) { this.closedListeners.add(fn); return { dispose: () => this.closedListeners.delete(fn) }; }

  /** Idle connections are closed after `minutes` without use; 0 turns it off. */
  setIdleMinutes(minutes: number) {
    this.idleMs = Math.max(0, minutes) * 60_000;
    if (this.sweeper) { clearInterval(this.sweeper); this.sweeper = undefined; }
    if (this.idleMs > 0) { this.sweeper = setInterval(() => void this.closeIdle(), Math.min(30_000, Math.max(1_000, this.idleMs / 2))); this.sweeper.unref?.(); }
  }
  async closeIdle(now = Date.now()) {
    if (this.idleMs <= 0) return;
    for (const id of [...this.ready]) {
      if (this.isBusy(id)) { this.lastUsed.set(id, now); continue; }
      if (now - (this.lastUsed.get(id) ?? now) < this.idleMs) continue;
      await this.disconnect(id);
      for (const fn of this.closedListeners) fn(id, "idle");
    }
  }

  connect(id: string, vars: Record<string, string> = {}): Promise<Connection> {
    const existing = this.open.get(id);
    if (existing) { this.lastUsed.set(id, Date.now()); return existing; }
    const p = this.get(id);
    if (!p) return Promise.reject(new Error(`Unknown connection: ${id}`));
    const pending = (async () => {
      const driver = await this.loadDriver(p.driver);
      // catalog entries carry no secrets: ask this user once and keep the answer in their own SecretStorage
      for (const k of p.secretKeys) {
        if (await this.secrets.get(`rizomadb/${p.id}/${k}`) !== undefined) continue;
        const v = await this.hooks.promptSecret?.(p, k);
        if (v === undefined) throw new Error(`Credentials for "${p.name}" were not provided.`);
        await saveSecrets(this.secrets, p.id, [k], { [k]: v });
      }
      const cfg = await resolveConfig({ ...p, readOnly: this.isReadOnly(p) }, this.secrets, this.env, vars);
      this.known.set(id, Object.entries(cfg).filter(([k, v]) => typeof v === "string" && v.length >= 4 && (p.secretKeys.includes(k) || /pass|secret|token|key|uri/i.test(k))).map(([, v]) => v as string));
      const ssh = takeSsh(cfg);
      const proxy = takeProxy(cfg);
      if (ssh && proxy) throw new Error("Choose either an SSH tunnel or a proxy for this connection, not both.");
      if (proxy) {
        const defaultPort = Number((driver.connectionSchema.properties.port as { default?: unknown } | undefined)?.default ?? 0);
        const tunnel = await within(this.connectTimeoutMs, `the proxy for "${p.name}"`, openProxyTunnel({ proxy, target: { host: String(cfg.host), port: Number(cfg.port ?? defaultPort) } }), (t) => void t.close().catch(() => {}));
        this.tunnels.set(id, tunnel);
        cfg.host = "127.0.0.1"; cfg.port = tunnel.localPort;
      }
      if (ssh) {
        if (!this.openSsh) throw new Error("SSH tunnels are not available in this environment");
        const defaultPort = Number((driver.connectionSchema.properties.port as { default?: unknown } | undefined)?.default ?? 0);
        const target = { host: String(cfg.host), port: Number(cfg.port ?? defaultPort) };
        const tunnel = await within(this.connectTimeoutMs, `the SSH tunnel for "${p.name}"`, this.openSsh(ssh, target), (t) => void t.close().catch(() => {}));
        this.tunnels.set(id, tunnel);
        cfg.host = "127.0.0.1"; cfg.port = tunnel.localPort;
      }
      try {
        const raw = await within(this.connectTimeoutMs, `"${p.name}"`, driver.connect(cfg, { log: () => {} }), (c) => void c.close().catch(() => {}));
        // Every feature receives this guarded connection: one policy check and one audit trail for all of them.
        return guardConnection(raw, {
          plugin: driver, connectionId: id, connectionName: p.name, environment: p.environment,
          readOnly: () => this.isReadOnly(this.get(id) ?? p), policy: this.getPolicy, redact: (s: string) => redactString(s, this.known.get(id) ?? []), ...(this.hooks.audit ? { audit: this.hooks.audit } : {}),
          ...(this.hooks.approve ? { approve: (reason: string, statement: string) => this.hooks.approve!(p.name, reason, statement) } : {}),
        });
      }
      catch (e) { await this.tunnels.get(id)?.close().catch(() => {}); this.tunnels.delete(id); throw e; }
    })();
    this.open.set(id, pending);
    this.lastUsed.set(id, Date.now());
    this.fire();
    pending.then(() => { if (this.open.get(id) === pending) this.ready.add(id); this.fire(); }, () => { if (this.open.get(id) === pending) { this.open.delete(id); this.lastUsed.delete(id); } this.fire(); });
    return pending;
  }

  async disconnect(id: string) {
    const c = this.open.get(id);
    this.open.delete(id); this.ready.delete(id); this.lastUsed.delete(id);
    if (c) await c.then((x) => x.close(), () => {});
    await this.tunnels.get(id)?.close().catch(() => {});
    this.tunnels.delete(id);
    this.fire();
  }

  async disposeAll() {
    if (this.sweeper) { clearInterval(this.sweeper); this.sweeper = undefined; } await Promise.all([...this.open.keys()].map((id) => this.disconnect(id))); }
}

/** Flat `ssh.*` options hold the tunnel settings; they are removed before the driver sees the config. */
function takeSsh(cfg: Record<string, unknown>): SshSettings | undefined {
  const get = (k: string) => cfg[`ssh.${k}`];
  const host = get("host");
  const out: SshSettings | undefined = typeof host === "string" && host
    ? { host, port: Number(get("port") ?? 22), username: String(get("username") ?? ""),
        ...(typeof get("password") === "string" ? { password: get("password") as string } : {}),
        ...(typeof get("keyPath") === "string" ? { keyPath: get("keyPath") as string } : {}),
        ...(typeof get("passphrase") === "string" ? { passphrase: get("passphrase") as string } : {}) }
    : undefined;
  for (const k of Object.keys(cfg)) if (k.startsWith("ssh.")) delete cfg[k];
  return out;
}

/** Flat `proxy.*` options (type http|socks5, host, port, username, password) route the database connection through a proxy. */
function takeProxy(cfg: Record<string, unknown>): ProxySettings | undefined {
  const get = (k: string) => cfg[`proxy.${k}`];
  const type = get("type"), host = get("host");
  let out: ProxySettings | undefined;
  if (typeof host === "string" && host) {
    if (type !== "http" && type !== "socks5") throw new Error(`Unsupported proxy type "${String(type)}": use http or socks5.`);
    out = { type, host, port: Number(get("port") ?? (type === "http" ? 3128 : 1080)),
      ...(typeof get("username") === "string" && get("username") ? { username: get("username") as string } : {}),
      ...(typeof get("password") === "string" ? { password: get("password") as string } : {}) };
  }
  for (const k of Object.keys(cfg)) if (k.startsWith("proxy.")) delete cfg[k];
  return out;
}

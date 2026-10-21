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

export type CatalogProfile = ConnectionProfile & { source: string };

export class ConnectionManager {
  private catalog: CatalogProfile[] = [];
  private open = new Map<string, Promise<Connection>>();
  private tunnels = new Map<string, OpenTunnel>();
  /** Secret values seen while connecting, per connection, so messages can be scrubbed. */
  private known = new Map<string, string[]>();
  private listeners = new Set<() => void>();

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
    const out: ConnectionProfile[] = [];
    for (const r of raw) { try { out.push(parseProfile(r)); } catch { /* ignore invalid stored profile */ } }
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

  async update(id: string, patch: Partial<Pick<ConnectionProfile, "readOnly" | "name" | "environment">>) {
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
    return p.readOnly || !!ruleFor(this.getPolicy(), p.environment).readOnly;
  }

  isConnected(id: string) { return this.open.has(id); }

  connect(id: string, vars: Record<string, string> = {}): Promise<Connection> {
    const existing = this.open.get(id);
    if (existing) return existing;
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
        const tunnel = await openProxyTunnel({ proxy, target: { host: String(cfg.host), port: Number(cfg.port ?? defaultPort) } });
        this.tunnels.set(id, tunnel);
        cfg.host = "127.0.0.1"; cfg.port = tunnel.localPort;
      }
      if (ssh) {
        if (!this.openSsh) throw new Error("SSH tunnels are not available in this environment");
        const defaultPort = Number((driver.connectionSchema.properties.port as { default?: unknown } | undefined)?.default ?? 0);
        const target = { host: String(cfg.host), port: Number(cfg.port ?? defaultPort) };
        const tunnel = await this.openSsh(ssh, target);
        this.tunnels.set(id, tunnel);
        cfg.host = "127.0.0.1"; cfg.port = tunnel.localPort;
      }
      try {
        const raw = await driver.connect(cfg, { log: () => {} });
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
    pending.then(() => this.fire(), () => this.open.delete(id));
    return pending;
  }

  async disconnect(id: string) {
    const c = this.open.get(id);
    this.open.delete(id);
    if (c) await c.then((x) => x.close(), () => {});
    await this.tunnels.get(id)?.close().catch(() => {});
    this.tunnels.delete(id);
    this.fire();
  }

  async disposeAll() { await Promise.all([...this.open.keys()].map((id) => this.disconnect(id))); }
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

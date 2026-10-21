import type { Connection, DriverPlugin } from "@rizomadb/driver-api";
import { parseProfile, resolveConfig, saveSecrets, type ConnectionProfile, type Policy, type SecretStore } from "@rizomadb/core";

export interface Memento {
  get<T>(key: string, fallback: T): T;
  update(key: string, value: unknown): PromiseLike<void> | Promise<void>;
}

export type DriverRegistry = Record<string, () => Promise<DriverPlugin>>;

const KEY = "rizomadb.profiles";

export class ConnectionManager {
  private open = new Map<string, Promise<Connection>>();
  private listeners = new Set<() => void>();

  constructor(
    private state: Memento, private secrets: SecretStore, private registry: DriverRegistry,
    private getPolicy: () => Policy, private env: Record<string, string | undefined> = process.env,
  ) {}

  onChange(fn: () => void) { this.listeners.add(fn); return { dispose: () => this.listeners.delete(fn) }; }
  private fire() { this.listeners.forEach((f) => f()); }

  driverIds() { return Object.keys(this.registry); }
  loadDriver(id: string) {
    const f = this.registry[id];
    if (!f) throw new Error(`Unknown driver: ${id}`);
    return f();
  }

  list(): ConnectionProfile[] {
    const raw = this.state.get<unknown[]>(KEY, []);
    const out: ConnectionProfile[] = [];
    for (const r of raw) { try { out.push(parseProfile(r)); } catch { /* ignore invalid stored profile */ } }
    return out;
  }
  get(id: string) { return this.list().find((p) => p.id === id); }

  async add(p: Omit<ConnectionProfile, "options" | "secretKeys"> & { values: Record<string, unknown>; secretKeys: string[] }) {
    const { values, ...rest } = p;
    const options = await saveSecrets(this.secrets, p.id, p.secretKeys, values);
    const profile = parseProfile({ ...rest, options });
    await this.state.update(KEY, [...this.list().filter((x) => x.id !== p.id), profile]);
    this.fire();
    return profile;
  }

  async update(id: string, patch: Partial<Pick<ConnectionProfile, "readOnly" | "name" | "environment">>) {
    const cur = this.get(id);
    if (!cur) return;
    await this.disconnect(id);
    await this.state.update(KEY, this.list().map((x) => (x.id === id ? { ...x, ...patch } : x)));
    this.fire();
  }

  async remove(id: string) {
    const p = this.get(id);
    await this.disconnect(id);
    if (p) for (const k of p.secretKeys) await this.secrets.delete(`rizomadb/${id}/${k}`);
    await this.state.update(KEY, this.list().filter((x) => x.id !== id));
    this.fire();
  }

  /** The effective read-only flag: profile setting OR environment policy. */
  isReadOnly(p: ConnectionProfile) {
    return p.readOnly || this.getPolicy().readOnlyEnvironments.includes(p.environment);
  }

  isConnected(id: string) { return this.open.has(id); }

  connect(id: string, vars: Record<string, string> = {}): Promise<Connection> {
    const existing = this.open.get(id);
    if (existing) return existing;
    const p = this.get(id);
    if (!p) return Promise.reject(new Error(`Unknown connection: ${id}`));
    const pending = (async () => {
      const driver = await this.loadDriver(p.driver);
      const cfg = await resolveConfig({ ...p, readOnly: this.isReadOnly(p) }, this.secrets, this.env, vars);
      return driver.connect(cfg, { log: () => {} });
    })();
    this.open.set(id, pending);
    pending.then(() => this.fire(), () => this.open.delete(id));
    return pending;
  }

  async disconnect(id: string) {
    const c = this.open.get(id);
    this.open.delete(id);
    if (c) await c.then((x) => x.close(), () => {});
    this.fire();
  }

  async disposeAll() { await Promise.all([...this.open.keys()].map((id) => this.disconnect(id))); }
}

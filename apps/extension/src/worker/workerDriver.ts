import { fork, type ChildProcess } from "node:child_process";
import {
  DriverError, type Connection, type DriverPlugin, type DriverErrorKind, type ExecuteRequest, type IntrospectionApi,
  type ResolvedConnectionConfig, type ResultEvent, type ServerInfo, type Transaction,
} from "@rizomadb/driver-api";
import type { ConnectResult, NextResult, Request, Response, WireError } from "./protocol.js";

/** Grace period before a driver that cannot cancel server-side is killed (its worker is terminated). */
const KILL_AFTER_MS = 400;

type Distribute<T> = T extends unknown ? Omit<T, "id"> : never;

type Meta = Omit<DriverPlugin, "connect">;

class WorkerConnection implements Connection {
  private worker!: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, { resolve(v: unknown): void; reject(e: unknown): void }>();
  private target = 0;
  serverInfo!: ServerInfo;
  quoteIdent: (n: string) => string;

  constructor(private plugin: Meta, private workerFile: string, private cfg: ResolvedConnectionConfig, private killOnCancel: boolean) {
    this.quoteIdent = plugin.quoteIdent;
  }

  private spawn() {
    // A child process (not a thread) so a driver stuck in a native call can be SIGKILLed.
    // ELECTRON_RUN_AS_NODE makes VS Code's Electron binary behave as plain Node.
    this.worker = fork(this.workerFile, [], { serialization: "advanced", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, execArgv: [] });
    this.worker.on("message", (m: Response) => {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.result); else p.reject(toError(m.error));
    });
    const dead = (e: unknown) => {
      for (const p of this.pending.values()) p.reject(new DriverError("connection", `Driver worker stopped: ${(e as Error)?.message ?? "exited"}`));
      this.pending.clear();
    };
    this.worker.on("error", dead);
    this.worker.on("exit", () => dead(undefined));
    this.worker.unref();
    this.worker.channel?.unref();
  }

  private ready: Promise<void> = Promise.resolve();

  private async rpc<T>(m: Distribute<Request>): Promise<T> {
    await this.ready;
    return this.rawRpc<T>(m);
  }

  private rawRpc<T>(m: Distribute<Request>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.send({ ...m, id });
    });
  }

  async init() {
    this.spawn();
    const r = await this.rawRpc<ConnectResult>({ op: "connect", driver: this.plugin.id, cfg: this.cfg });
    this.target = r.target; this.serverInfo = r.serverInfo;
  }

  private async respawn() {
    await this.stop();
    await this.init();
  }

  private stop() {
    return new Promise<void>((res) => {
      if (this.worker.exitCode !== null || this.worker.signalCode !== null) return res();
      this.worker.once("exit", () => res());
      this.worker.kill("SIGKILL");
    });
  }

  execute(req: ExecuteRequest, signal: AbortSignal) { return this.stream(this.target, req, signal); }

  private async *stream(target: number, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    if (signal.aborted) throw new DriverError("cancelled", "Query cancelled");
    const rid = this.nextId;
    await this.rpc({ op: "execute", target, req });
    let killed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      this.worker.send({ op: "abort", rid });
      if (this.killOnCancel) timer = setTimeout(() => { killed = true; this.ready = this.respawn(); this.ready.catch(() => {}); }, KILL_AFTER_MS);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      for (;;) {
        let r: NextResult;
        try { r = await this.rpc<NextResult>({ op: "next", rid }); }
        catch (e) { if (killed) await this.ready.catch(() => {}); if (killed || signal.aborted) throw new DriverError("cancelled", "Query cancelled"); throw e; }
        if (r.done) return;
        yield r.value!;
        if (signal.aborted && !killed) throw new DriverError("cancelled", "Query cancelled");
      }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  }

  introspect(): IntrospectionApi {
    const call = <T>(method: "listSchemas" | "listTables" | "describeTable" | "describeSchema" | "foreignKeys", ...args: unknown[]) => this.rpc<T>({ op: "call", target: this.target, method, args });
    return {
      listSchemas: () => call("listSchemas"),
      listTables: (s) => call("listTables", s),
      describeTable: (r) => call("describeTable", r),
      describeSchema: (s) => call("describeSchema", s),
      foreignKeys: (s) => call("foreignKeys", s),
    };
  }

  async begin(): Promise<Transaction> {
    const tx = await this.rpc<number>({ op: "call", target: this.target, method: "begin", args: [] });
    return {
      execute: (req, signal) => this.stream(tx, req, signal),
      commit: async () => { await this.rpc({ op: "call", target: tx, method: "commit", args: [] }); },
      rollback: async () => { await this.rpc({ op: "call", target: tx, method: "rollback", args: [] }); },
    };
  }

  async ping() { await this.rpc({ op: "call", target: this.target, method: "ping", args: [] }); }
  async close() {
    await this.rpc({ op: "call", target: this.target, method: "close", args: [] }).catch(() => {});
    await this.stop();
  }
}

const toError = (e: WireError) =>
  new DriverError(e.kind as DriverErrorKind, e.message, { ...(e.position !== undefined ? { position: e.position } : {}), ...(e.code ? { code: e.code } : {}) });

/**
 * Wraps a driver so each connection runs in its own worker thread: a crash or a
 * blocked synchronous driver cannot freeze the extension host. Drivers without
 * server-side cancel are cancelled by terminating and recreating the worker.
 */
export function workerDriver(plugin: Omit<DriverPlugin, "connect">, workerFile: string): DriverPlugin {
  const killOnCancel = !plugin.capabilities.cancelQuery;
  return {
    ...plugin,
    capabilities: { ...plugin.capabilities, cancelQuery: true },
    async connect(cfg) {
      const c = new WorkerConnection(plugin, workerFile, cfg, killOnCancel);
      try { await c.init(); } catch (e) { await c.close().catch(() => {}); throw e; }
      return c;
    },
  };
}

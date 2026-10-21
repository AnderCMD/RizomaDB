import { DriverError, collect, type Connection, type DriverPlugin, type ExecuteRequest, type ResultEvent, type Transaction } from "@rizomadb/driver-api";
import { assessStatement, type Assessment } from "./policy.js";
import { decideEffective, statementKind, type EffectivePolicy } from "./effective-policy.js";
import type { AuditLog } from "./audit.js";

export interface GuardContext {
  plugin: Pick<DriverPlugin, "assess" | "id">;
  connectionId: string;
  connectionName: string;
  environment: string;
  /** Live value: the user can toggle read-only while connected. */
  readOnly: () => boolean;
  policy: () => EffectivePolicy;
  audit?: AuditLog;
  /** Called for statements the policy lets through but that need approval; return false to refuse. Default: refuse. */
  approve?: (reason: string, statement: string) => Promise<boolean>;
  /** Removes secrets from messages before they reach the audit trail or the UI. */
  redact?: (text: string) => string;
}

/**
 * Wraps a connection so every statement, from any feature, passes one policy check and lands in the audit trail.
 * Features cannot opt out: they only ever receive the guarded connection.
 */
export function guardConnection(inner: Connection, g: GuardContext): Connection {
  const assess: (s: string) => Assessment = g.plugin.assess ?? assessStatement;
  const verb = (sql: string) => (statementKind(sql) ?? sql.trim().split(/\s+/)[0] ?? "?").toUpperCase();

  async function* guarded(run: (req: ExecuteRequest, signal: AbortSignal) => AsyncIterable<ResultEvent>, req: ExecuteRequest, signal: AbortSignal): AsyncGenerator<ResultEvent> {
    const d = decideEffective(req.sql, { environment: g.environment, readOnly: g.readOnly() }, g.policy(), assess);
    const base = { connectionId: g.connectionId, connection: g.connectionName, environment: g.environment, engine: g.plugin.id, kind: verb(req.sql), statement: req.sql };
    if (!d.allowed) { void g.audit?.record({ ...base, status: "blocked", detail: d.reason ?? "blocked" }); throw new DriverError("permission", d.reason ?? "Blocked by policy"); }
    if (d.needsApproval && !(await g.approve?.(d.reason ?? "approval required", req.sql))) {
      void g.audit?.record({ ...base, status: "blocked", detail: "approval not given" });
      throw new DriverError("permission", "This environment requires approval before changing data, and none was given.");
    }
    const cap = d.maxRows !== undefined ? Math.min(req.maxRows ?? Infinity, d.maxRows) : req.maxRows;
    const t0 = performance.now(); let rows = 0;
    const timeout = d.timeoutSeconds ? AbortSignal.timeout(d.timeoutSeconds * 1000) : undefined;
    const sig = timeout ? AbortSignal.any([signal, timeout]) : signal;
    try {
      for await (const ev of run({ ...req, ...(cap !== undefined ? { maxRows: cap } : {}) }, sig)) { if (ev.type === "done") rows = ev.affectedRows ?? ev.rowCount; yield ev; }
      void g.audit?.record({ ...base, status: "ok", rows, durationMs: Math.round(performance.now() - t0) });
    } catch (e) {
      const cancelled = e instanceof DriverError && e.kind === "cancelled";
      const scrub = (s: string) => (g.redact ? g.redact(s) : s);
      void g.audit?.record({ ...base, status: cancelled ? "cancelled" : "error", durationMs: Math.round(performance.now() - t0), detail: scrub((e as Error).message) });
      if (timeout?.aborted && cancelled) throw new DriverError("timeout", `Query exceeded the ${d.timeoutSeconds}s limit set by policy`, { cause: e });
      // a driver error may echo a connection string or password: rebuild it from the scrubbed message (the original is not kept as `cause`)
      if (g.redact && e instanceof DriverError && scrub(e.message) !== e.message) throw new DriverError(e.kind, scrub(e.message), { ...(e.position !== undefined ? { position: e.position } : {}), ...(e.code ? { code: e.code } : {}) });
      throw e;
    }
  }

  const wrapTx = (tx: Transaction): Transaction => ({ execute: (req, signal) => guarded((r, s) => tx.execute(r, s), req, signal), commit: () => tx.commit(), rollback: () => tx.rollback() });

  return {
    get serverInfo() { return inner.serverInfo; },
    execute: (req, signal) => guarded((r, s) => inner.execute(r, s), req, signal),
    introspect: () => inner.introspect(),
    quoteIdent: (n) => inner.quoteIdent(n),
    ...(inner.begin ? { begin: async () => wrapTx(await inner.begin!()) } : {}),
    ping: () => inner.ping(),
    close: () => inner.close(),
  };
}

export { collect };

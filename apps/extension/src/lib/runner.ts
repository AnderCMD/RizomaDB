import { DriverError, type Connection, type ColumnInfo, type Value } from "@rizomadb/driver-api";
import { decideEffective, type Assessment, type EffectivePolicy, type ConnectionProfile } from "@rizomadb/core";

export type RunEvent =
  | { type: "start"; sql: string; columns: ColumnInfo[] }
  | { type: "rows"; rows: Value[][] }
  | { type: "done"; rowCount: number; affectedRows?: number; durationMs: number; truncated: boolean }
  | { type: "error"; kind: string; message: string; position?: number };

export interface RunOptions {
  /** Rows to read and drop before the first one shown: how the next page of a result is reached on every engine. */
  skip?: number;
  conn: Connection;
  profile: ConnectionProfile;
  sql: string;
  params?: Value[];
  maxRows: number;
  timeoutMs?: number;
  signal: AbortSignal;
  policy: EffectivePolicy;
  /** Engine-specific classifier (non-SQL engines); defaults to the SQL heuristic. */
  assess?: (command: string) => Assessment;
  readOnly: boolean;
  confirmDestructive: boolean;
  confirm: (reason: string) => Promise<boolean>;
  onEvent: (e: RunEvent) => void;
}

export interface RunOutcome {
  status: "ok" | "error" | "cancelled" | "blocked";
  rowCount: number; durationMs: number; error?: string;
}

/** Single path for every statement the UI runs: policy first, then the driver. */
export async function runStatement(o: RunOptions): Promise<RunOutcome> {
  const t0 = performance.now();
  const decision = decideEffective(o.sql, { environment: o.profile.environment, readOnly: o.readOnly }, o.policy, o.assess);
  if (!decision.allowed) {
    o.onEvent({ type: "error", kind: "permission", message: decision.reason ?? "Blocked by policy" });
    return { status: "blocked", rowCount: 0, durationMs: 0, error: decision.reason ?? "Blocked by policy" };
  }
  // A user preference can switch off the routine destructive prompt, never a confirmation the policy asks for.
  if (decision.needsConfirmation && (o.confirmDestructive || decision.confirmSource === "policy")) {
    if (!(await o.confirm(decision.reason ?? "This statement modifies data"))) {
      o.onEvent({ type: "error", kind: "cancelled", message: "Cancelled: not confirmed" });
      return { status: "cancelled", rowCount: 0, durationMs: 0 };
    }
  }

  const ac = new AbortController();
  let timedOut = false;
  const onAbort = () => ac.abort();
  o.signal.addEventListener("abort", onAbort, { once: true });
  const timer = o.timeoutMs ? setTimeout(() => { timedOut = true; ac.abort(); }, o.timeoutMs) : undefined;
  let rowCount = 0, toSkip = o.skip ?? 0;
  try {
    for await (const ev of o.conn.execute({ sql: o.sql, ...(o.params ? { params: o.params } : {}), maxRows: toSkip + o.maxRows + 1 }, ac.signal)) {
      if (ev.type === "columns") o.onEvent({ type: "start", sql: o.sql, columns: ev.columns });
      else if (ev.type === "rows") {
        let batch = ev.rows;
        if (toSkip > 0) { const drop = Math.min(toSkip, batch.length); batch = batch.slice(drop); toSkip -= drop; }
        const room = o.maxRows - rowCount;
        const slice = batch.length > room ? batch.slice(0, room) : batch;
        rowCount += slice.length;
        if (slice.length) o.onEvent({ type: "rows", rows: slice });
        if (batch.length > room) { ac.abort(); throw new DriverError("cancelled", "row limit"); }
      } else if (ev.type === "done") {
        o.onEvent({ type: "done", rowCount, durationMs: ev.durationMs, truncated: false, ...(ev.affectedRows !== undefined ? { affectedRows: ev.affectedRows } : {}) });
      }
    }
    return { status: "ok", rowCount, durationMs: performance.now() - t0 };
  } catch (e) {
    const durationMs = performance.now() - t0;
    if (rowCount >= o.maxRows && e instanceof DriverError && e.kind === "cancelled" && !o.signal.aborted && !timedOut) {
      o.onEvent({ type: "done", rowCount, durationMs, truncated: true });
      return { status: "ok", rowCount, durationMs };
    }
    const err = e instanceof DriverError ? e : new DriverError("unknown", (e as Error).message ?? String(e));
    if (timedOut) {
      o.onEvent({ type: "error", kind: "timeout", message: "Query timed out" });
      return { status: "error", rowCount, durationMs, error: "Query timed out" };
    }
    o.onEvent({ type: "error", kind: err.kind, message: err.message, ...(err.position !== undefined ? { position: err.position } : {}) });
    return { status: err.kind === "cancelled" ? "cancelled" : "error", rowCount, durationMs, error: err.message };
  } finally {
    if (timer) clearTimeout(timer);
    o.signal.removeEventListener("abort", onAbort);
  }
}

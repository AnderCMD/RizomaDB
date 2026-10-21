import { collect, type Connection, type Value } from "@rizomadb/driver-api";

export interface PlanNode {
  label: string;
  detail?: string;
  /** Estimated and (with ANALYZE) actual rows. */
  rows?: number;
  actualRows?: number;
  cost?: number;
  timeMs?: number;
  children: PlanNode[];
}

export interface Plan { root: PlanNode[]; totalCost?: number; executionMs?: number; raw: string; analyzed: boolean }

const num = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));
const sig = new AbortController().signal;
const run = async (c: Connection, sql: string) => (await collect(c.execute({ sql }, sig))).rows;
const str = (v: Value) => (typeof v === "string" ? v : v === null ? "" : typeof v === "object" && !(v instanceof Date) && !(v instanceof Uint8Array) && !Array.isArray(v) ? JSON.stringify((v as { json: unknown }).json) : String(v));

/** Highlights the nodes that dominate runtime/cost (>= `share` of the total). */
export function slowNodes(plan: Plan, share = 0.3): PlanNode[] {
  const out: PlanNode[] = [];
  const total = plan.executionMs ?? plan.totalCost ?? 0;
  const visit = (n: PlanNode) => {
    const own = plan.executionMs !== undefined ? (n.timeMs ?? 0) - n.children.reduce((a, c) => a + (c.timeMs ?? 0), 0) : (n.cost ?? 0) - n.children.reduce((a, c) => a + (c.cost ?? 0), 0);
    if (total > 0 && own / total >= share) out.push(n);
    n.children.forEach(visit);
  };
  plan.root.forEach(visit);
  return out;
}

export function parsePostgresPlan(json: unknown, analyzed: boolean): Plan {
  const top = (Array.isArray(json) ? json[0] : json) as { Plan: PgNode; "Execution Time"?: number };
  const conv = (n: PgNode): PlanNode => ({
    label: n["Node Type"] + (n["Relation Name"] ? ` on ${n["Relation Name"]}` : ""),
    detail: [n["Index Name"] && `index ${n["Index Name"]}`, n["Filter"] && `filter ${n["Filter"]}`, n["Join Type"] && `${n["Join Type"]} join`, n["Hash Cond"] && n["Hash Cond"], n["Sort Key"] && `sort ${n["Sort Key"].join(", ")}`].filter(Boolean).join(" · "),
    ...(num(n["Plan Rows"]) !== undefined ? { rows: n["Plan Rows"] } : {}),
    ...(analyzed && n["Actual Rows"] !== undefined ? { actualRows: n["Actual Rows"] * (n["Actual Loops"] ?? 1) } : {}),
    ...(n["Total Cost"] !== undefined ? { cost: n["Total Cost"] } : {}),
    ...(analyzed && n["Actual Total Time"] !== undefined ? { timeMs: n["Actual Total Time"] * (n["Actual Loops"] ?? 1) } : {}),
    children: (n.Plans ?? []).map(conv),
  });
  const root = conv(top.Plan);
  return { root: [root], ...(root.cost !== undefined ? { totalCost: root.cost } : {}), ...(top["Execution Time"] !== undefined ? { executionMs: top["Execution Time"] } : {}), raw: JSON.stringify(json, null, 2), analyzed };
}
interface PgNode { "Node Type": string; "Relation Name"?: string; "Index Name"?: string; Filter?: string; "Join Type"?: string; "Hash Cond"?: string; "Sort Key"?: string[]; "Plan Rows"?: number; "Actual Rows"?: number; "Actual Loops"?: number; "Total Cost"?: number; "Actual Total Time"?: number; Plans?: PgNode[] }

export function parseMysqlPlan(json: unknown): Plan {
  const nodes: PlanNode[] = [];
  const walk = (o: unknown, out: PlanNode[]) => {
    if (Array.isArray(o)) { o.forEach((x) => walk(x, out)); return; }
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    if (typeof r.table_name === "string") {
      const ci = r.cost_info as { prefix_cost?: string } | undefined;
      out.push({ label: `${String(r.access_type ?? "access")} on ${r.table_name}`, detail: [r.key && `key ${String(r.key)}`, r.attached_condition && `filter ${String(r.attached_condition)}`].filter(Boolean).join(" · "),
        ...(num(r.rows_examined_per_scan) !== undefined ? { rows: num(r.rows_examined_per_scan)! } : {}), ...(num(ci?.prefix_cost) !== undefined ? { cost: num(ci?.prefix_cost)! } : {}), children: [] });
      return;
    }
    for (const v of Object.values(r)) walk(v, out);
  };
  walk(json, nodes);
  const qb = (json as { query_block?: { cost_info?: { query_cost?: string } } }).query_block;
  return { root: nodes, ...(num(qb?.cost_info?.query_cost) !== undefined ? { totalCost: num(qb?.cost_info?.query_cost)! } : {}), raw: JSON.stringify(json, null, 2), analyzed: false };
}

export function parseSqlitePlan(rows: { id: number; parent: number; detail: string }[]): Plan {
  const byId = new Map<number, PlanNode & { parent: number }>();
  for (const r of rows) byId.set(r.id, { label: r.detail.split(" ")[0] ?? r.detail, detail: r.detail, children: [], parent: r.parent });
  const root: PlanNode[] = [];
  for (const n of byId.values()) { const p = byId.get(n.parent); if (p) p.children.push(n); else root.push(n); }
  return { root, raw: rows.map((r) => `${r.id} ${r.parent} ${r.detail}`).join("\n"), analyzed: false };
}

export function parseTreePlan(rows: { id: number; parent: number | null; label: string; detail?: string; rows?: number; cost?: number }[], raw: string): Plan {
  const byId = new Map<number, PlanNode>();
  for (const r of rows) byId.set(r.id, { label: r.label, ...(r.detail ? { detail: r.detail } : {}), ...(r.rows !== undefined ? { rows: r.rows } : {}), ...(r.cost !== undefined ? { cost: r.cost } : {}), children: [] });
  const root: PlanNode[] = [];
  for (const r of rows) { const n = byId.get(r.id)!; const p = r.parent === null ? undefined : byId.get(r.parent); if (p) p.children.push(n); else root.push(n); }
  const totalCost = root[0]?.cost;
  return { root, ...(totalCost !== undefined ? { totalCost } : {}), raw, analyzed: false };
}

/** Runs the engine's plan facility for `sql` (never executes it, except PostgreSQL EXPLAIN ANALYZE which does; callers must gate that). */
export async function explain(conn: Connection, engine: "postgres" | "mysql" | "sqlite" | "mssql" | "oracle", sql: string, opts: { analyze?: boolean } = {}): Promise<Plan> {
  const body = sql.replace(/;\s*$/, "");
  switch (engine) {
    case "postgres": {
      const rows = await run(conn, `EXPLAIN (FORMAT JSON${opts.analyze ? ", ANALYZE, BUFFERS" : ""}) ${body}`);
      const v = rows[0]![0]!;
      const json = typeof v === "string" ? JSON.parse(v) : (v as { json: unknown }).json;
      return parsePostgresPlan(json, !!opts.analyze);
    }
    case "mysql": {
      const v = (await run(conn, `EXPLAIN FORMAT=JSON ${body}`))[0]![0]!;
      return parseMysqlPlan(typeof v === "string" ? JSON.parse(v) : (v as { json: unknown }).json);
    }
    case "sqlite": {
      const rows = (await run(conn, `EXPLAIN QUERY PLAN ${body}`)).map((r) => ({ id: Number(r[0]), parent: Number(r[1]), detail: str(r[3]!) }));
      return parseSqlitePlan(rows);
    }
    case "mssql": {
      await run(conn, "SET SHOWPLAN_ALL ON");
      try {
        const res = await collect(conn.execute({ sql: body }, sig));
        const cols = res.columns.map((c) => c.name.toLowerCase());
        const ix = (n: string) => cols.indexOf(n);
        const rows = res.rows.map((r) => ({ id: Number(r[ix("nodeid")]), parent: Number(r[ix("parent")]), label: str(r[ix("physicalop")]!) || str(r[ix("stmttext")]!).slice(0, 60), detail: str(r[ix("stmttext")]!).trim(), rows: num(r[ix("estimaterows")]), cost: num(r[ix("totalsubtreecost")]) }));
        const mapped = rows.map((r) => ({ ...r, parent: r.parent === 0 ? null : r.parent })).filter((r) => r.label);
        return parseTreePlan(mapped as never, res.rows.map((r) => str(r[ix("stmttext")]!)).join("\n"));
      } finally { await run(conn, "SET SHOWPLAN_ALL OFF").catch(() => {}); }
    }
    case "oracle": {
      const id = `rz${Date.now().toString(36)}`;
      await run(conn, `EXPLAIN PLAN SET STATEMENT_ID = '${id}' FOR ${body}`);
      const res = await collect(conn.execute({ sql: `SELECT id, parent_id, operation, options, object_name, cardinality, cost FROM plan_table WHERE statement_id = '${id}' ORDER BY id` }, sig));
      const rows = res.rows.map((r) => ({ id: Number(r[0]), parent: r[1] === null ? null : Number(r[1]), label: `${str(r[2]!)}${r[3] ? " " + str(r[3]!) : ""}`.trim(), detail: r[4] ? str(r[4]!) : "", rows: num(r[5]), cost: num(r[6]) }));
      return parseTreePlan(rows, rows.map((r) => `${"  ".repeat(0)}${r.id} ${r.label} ${r.detail}`).join("\n"));
    }
  }
}

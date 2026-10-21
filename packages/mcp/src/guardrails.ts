import { tokenize, type Dialect } from "@rizomadb/sql";

export interface McpConnectionRule {
  /** Tables the agent may read (case-insensitive). Everything else is refused. */
  allowTables: string[];
  maxRows: number;
  timeoutSeconds: number;
  /** Columns to mask in results: names or /regex/. */
  maskColumns: { column: string; rule: "redact" | "nullify" | "hash" | "last4" }[];
}

export const defaultRule = (): McpConnectionRule => ({ allowTables: [], maxRows: 200, timeoutSeconds: 15, maskColumns: [] });

// Functions and clauses that read files, run programs, reach other servers or burn resources, whatever the statement looks like.
const DANGEROUS = /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_get|dblink\w*|copy|xp_cmdshell|xp_\w+|sp_oacreate|openrowset|openquery|opendatasource|bulk|load_file|load_extension|readfile|writefile|utl_file|utl_http|utl_tcp|dbms_\w+|sys_eval|sys_exec|pg_sleep|sleep|benchmark|waitfor|set_config|nextval|setval|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|current_setting|query_to_xml|database_to_xml|attach|detach|pragma|vacuum|install|into\s+(outfile|dumpfile)|read_csv\w*|read_parquet|read_json\w*|glob|httpfs)\b/i;

export interface Verdict { ok: boolean; reason?: string }

/** The agent may run one SELECT/WITH statement over allow-listed tables: nothing else. */
export function checkAgentQuery(sql: string, dialect: Dialect, rule: McpConnectionRule, allTables: string[]): Verdict {
  const toks = tokenize(sql, dialect);
  const sig = toks.filter((t) => t.type !== "ws" && t.type !== "comment");
  if (!sig.length) return { ok: false, reason: "Empty statement" };
  if (sig.some((t) => t.text === ";" && t !== sig.at(-1))) return { ok: false, reason: "Only one statement per call" };
  const first = sig[0]!.text.toLowerCase();
  if (first !== "select" && first !== "with") return { ok: false, reason: "Only SELECT queries are allowed" };
  // everything between quotes is data, not code
  const code = sig.filter((t) => t.type !== "string").map((t) => t.text).join(" ");
  if (DANGEROUS.test(code)) return { ok: false, reason: `The query uses a function or clause that is not allowed for agents (${DANGEROUS.exec(code)![0].toLowerCase()})` };
  if (/\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|call|exec|execute)\b/i.test(code.replace(/"[^"]*"|`[^`]*`|\[[^\]]*\]/g, ""))) return { ok: false, reason: "Statements that change data are not allowed" };
  const allow = new Set(rule.allowTables.map((t) => t.toLowerCase()));
  if (!allow.size) return { ok: false, reason: "No tables are allowed for this connection" };
  const idents = new Set(sig.filter((t) => t.type === "word" || t.type === "quoted").map((t) => t.text.replace(/^["`[]|["`\]]$/g, "").toLowerCase()));
  const touched = allTables.filter((t) => idents.has(t.toLowerCase()) && !allow.has(t.toLowerCase()));
  if (touched.length) return { ok: false, reason: `Table(s) not allowed: ${touched.join(", ")}. Allowed: ${[...allow].join(", ")}` };
  return { ok: true };
}

export class ConsoleSyntaxError extends Error {
  constructor(message: string, readonly position: number) { super(message); this.name = "ConsoleSyntaxError"; }
}

export interface ConsoleRequest { method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD"; path: string; body?: unknown; rawBody?: string }

/** Removes // and block comments outside strings so Dev-Tools-style bodies parse as JSON. */
export function stripJsonComments(s: string): string {
  let out = "", i = 0, str = false;
  while (i < s.length) {
    const c = s[i]!;
    if (str) { out += c; if (c === "\\") { out += s[i + 1] ?? ""; i += 2; continue; } if (c === '"') str = false; i++; continue; }
    if (c === '"') { str = true; out += c; i++; continue; }
    if (c === "/" && s[i + 1] === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && s[i + 1] === "*") { const e = s.indexOf("*/", i + 2); i = e < 0 ? s.length : e + 2; continue; }
    out += c; i++;
  }
  return out;
}

/** `GET /index/_search` on the first line, JSON body (optionally with comments and trailing commas) after it. */
export function parseConsole(text: string): ConsoleRequest {
  const t = text.replace(/^\s+/, "");
  const nl = t.indexOf("\n");
  const head = (nl < 0 ? t : t.slice(0, nl)).trim();
  const m = /^(GET|POST|PUT|DELETE|HEAD)\s+(\S+)$/i.exec(head);
  if (!m) throw new ConsoleSyntaxError('Start with a method and a path, for example: GET /my-index/_search', 0);
  const path = m[2]!.startsWith("/") ? m[2]! : `/${m[2]}`;
  const method = m[1]!.toUpperCase() as ConsoleRequest["method"];
  const rest = nl < 0 ? "" : t.slice(nl + 1);
  const rawBody = stripJsonComments(rest).trim();
  if (!rawBody) return { method, path };
  // NDJSON bodies (_bulk, _msearch) are sent as-is
  if (/\n\s*[{[]/.test(rawBody) && /^\{[^\n]*\}\s*\n\s*\{/.test(rawBody)) return { method, path, rawBody: rawBody + "\n" };
  try { return { method, path, body: JSON.parse(rawBody.replace(/,(\s*[}\]])/g, "$1")) }; }
  catch (e) {
    const pos = Number(/position (\d+)/.exec((e as Error).message)?.[1] ?? 0);
    throw new ConsoleSyntaxError(`Invalid JSON body: ${(e as Error).message}`, head.length + 1 + pos);
  }
}

export type Risk = "none" | "write" | "destructive";
const READ_POST = /\/(_search|_count|_msearch|_mget|_analyze|_validate\/query|_explain|_field_caps|_search\/template|_render\/template|_eql\/search|_sql|_terms_enum|_mtermvectors|_termvectors|_rank_eval|_async_search)(\/|$|\?)/;

export function assessConsole(text: string): { risk: Risk; reasons: string[] } {
  let r: ConsoleRequest;
  try { r = parseConsole(text); } catch { return { risk: "none", reasons: [] }; }
  const p = r.path.split("?")[0]!;
  if (r.method === "GET" || r.method === "HEAD") return { risk: "none", reasons: [] };
  if (r.method === "POST" && READ_POST.test(r.path)) return { risk: "none", reasons: [] };
  if (r.method === "DELETE") return { risk: /^\/(_all|\*)(\/|$)/.test(p) || /^\/[^/_]+$/.test(p) ? "destructive" : "write", reasons: [`DELETE ${p} removes data or an index`] };
  if (/\/_delete_by_query|\/_close$|\/_forcemerge|\/_shrink|\/_split|\/_clone/.test(p)) return { risk: "destructive", reasons: [`${p.split("/").pop()} is a heavy or destructive operation`] };
  if (/\/_update_by_query|\/_reindex|\/_bulk/.test(p)) return { risk: "write", reasons: ["Modifies many documents"] };
  return { risk: "write", reasons: [`${r.method} ${p} modifies the cluster`] };
}

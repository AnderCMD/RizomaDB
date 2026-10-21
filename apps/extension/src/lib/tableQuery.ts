export type FilterKind = "sql" | "mongo" | "es" | "cypher";

const SQL_DRIVERS = new Set(["sqlite", "postgres", "mysql", "mssql", "oracle", "clickhouse", "duckdb", "trino"]);
/** Which engines get the filter box above a table, and what kind of text it takes. */
export function filterKindOf(driver: string): FilterKind | undefined {
  if (SQL_DRIVERS.has(driver)) return "sql";
  return driver === "mongodb" ? "mongo" : driver === "elasticsearch" ? "es" : driver === "neo4j" ? "cypher" : undefined;
}

export class FilterError extends Error {}

/** The text without quoted strings, for scans that must not be fooled by their content. */
const unquoted = (s: string) => s.replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.)*"|`[^`]*`/g, " ");
/** A WHERE / ORDER BY fragment is one expression: it cannot end the statement or start a comment. */
function fragment(text: string, what: string): string {
  const x = text.trim();
  if (/;|--|\/\*|\*\//.test(unquoted(x))) throw new FilterError(`${what} cannot contain ";" or comments`);
  return x;
}
/** Brackets must pair up, so the text cannot close the call it is placed in and add its own. */
function balanced(text: string, what: string): string {
  const stack: string[] = [], pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("([{".includes(c)) stack.push(c);
    else if (pairs[c]) { if (stack.pop() !== pairs[c]) throw new FilterError(`${what} has unbalanced brackets`); }
  }
  if (stack.length || quote) throw new FilterError(`${what} has unbalanced brackets or quotes`);
  return text.trim();
}

export interface TableQueryInput { driver: string; quoted: string; schema?: string | undefined; name: string; where: string; order: string; limit: number }

/** The statement that shows a table with the filter and order the user typed. Throws FilterError for text it will not place in a statement. */
export function buildTableQuery(i: TableQueryInput): string {
  const kind = filterKindOf(i.driver);
  const n = Math.max(1, Math.floor(i.limit));
  if (kind === "sql") {
    const w = fragment(i.where, "The filter"), o = fragment(i.order, "The order");
    const tail = `${w ? ` WHERE ${w}` : ""}${o ? ` ORDER BY ${o}` : ""}`;
    if (i.driver === "mssql") return `SELECT TOP ${n} * FROM ${i.quoted}${tail}`;
    if (i.driver === "oracle") return `SELECT * FROM ${i.quoted}${tail} FETCH FIRST ${n} ROWS ONLY`;
    return `SELECT * FROM ${i.quoted}${tail} LIMIT ${n}`;
  }
  if (kind === "mongo") {
    const f = balanced(i.where, "The filter") || "{}", s = balanced(i.order, "The sort");
    const db = i.schema ? `.getSiblingDB(${JSON.stringify(i.schema)})` : "";
    return `db${db}.getCollection(${JSON.stringify(i.name)}).find(${f})${s ? `.sort(${s})` : ""}.limit(${n})`;
  }
  if (kind === "es") {
    if (!/^[\w.,*-]+$/.test(i.name)) throw new FilterError("The index name has characters a search path cannot hold");
    const o = i.order.trim();
    if (o && !/^[\w.@-]+(:(asc|desc))?$/i.test(o)) throw new FilterError("The order must look like field or field:desc");
    const [field, dir] = o.split(":");
    const body: Record<string, unknown> = { size: n, query: i.where.trim() ? { query_string: { query: i.where.trim() } } : { match_all: {} }, ...(field ? { sort: [{ [field]: { order: (dir ?? "asc").toLowerCase() } }] } : {}) };
    return `GET /${i.name}/_search\n${JSON.stringify(body, null, 2)}`;
  }
  if (kind === "cypher") {
    const w = balanced(fragment(i.where, "The filter"), "The filter"), o = fragment(i.order, "The order");
    return `MATCH (n:${i.quoted}) ${w ? `WHERE ${w} ` : ""}RETURN n${o ? ` ORDER BY ${o}` : ""} LIMIT ${n}`;
  }
  throw new FilterError("This engine has no table filter");
}

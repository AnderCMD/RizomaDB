/**
 * Turns a JDBC URL into the values of a RizomaDB connection form. Pure string code (no Node or VS Code API), so the webview, the importer and the tests share it.
 * Messages are English sources: the UI translates them by these exact strings (`{0}` placeholders are filled with `args`).
 */
export const NOTE_PREFER = "sslmode=require only encrypts here: certificates are verified. Turn off “Verify server certificate” if the server uses a private CA you cannot add.";
export const NOTE_ORACLE_FIRST = "The URL lists {0} addresses; the first one was used.";
export const NOTE_IGNORED = "These options are not used by RizomaDB: {0}.";
export const NOTE_PASSWORD = "The password in the URL was put in the password field; it is stored in VS Code's secret storage when you save.";
export const NOTE_NEO4J_PORT = "RizomaDB talks to Neo4j over its HTTP Query API: check the port (7474, or 7473 with TLS), the Bolt port in the URL is not used.";
export const NOTE_MSSQL_INSTANCE = "The SQL Server instance name was ignored: enter the instance's port instead (RizomaDB does not use the SQL Server Browser service).";
export const NOTE_MONGO_URI = "The whole connection string was put in the URI field; it is stored as a secret because it may contain credentials.";

export const ERR_NOT_JDBC = "This is not a JDBC URL: it must start with jdbc:";
export const ERR_UNSUPPORTED = "RizomaDB has no connection for the JDBC subprotocol “{0}”.";
export const ERR_MALFORMED = "The JDBC URL could not be read: {0}.";
export const ERR_ORACLE_OCI = "Oracle OCI (thick) URLs need the Oracle Client: use the thin form, jdbc:oracle:thin:@//host:1521/service.";
export const ERR_ORACLE_TNS = "The URL uses a TNS alias, which needs a tnsnames.ora file: use host, port and service name (or a full DESCRIPTION).";
export const ERR_ORACLE_TCPS = "Oracle TCPS (TLS) connections are not supported yet.";
export const ERR_INTEGRATED = "Windows integrated security is not supported: use a SQL Server user and password.";

export class JdbcUrlError extends Error {
  constructor(readonly template: string, readonly args: string[] = []) { super(args.reduce((m, a, i) => m.replace(`{${i}}`, a), template)); }
}

export interface JdbcConnection {
  /** The driver id (`postgres`, `mysql`, `oracle`…): several engines share one (MariaDB uses `mysql`). */
  driver: string;
  /** Values keyed like the driver's connection form (`host`, `port`, `database`, `service`, `user`, `password`…). */
  values: Record<string, string | number | boolean>;
  /** Which keys of `values` are secrets. */
  secretKeys: string[];
  /** Notes to show to the person, as English sources with their `{0}` arguments. */
  notes: { template: string; args?: string[] }[];
  name: string;
}

/** The drivers a JDBC URL can fill in. */
export const JDBC_DRIVERS: ReadonlySet<string> = new Set(["postgres", "mysql", "mssql", "oracle", "sqlite", "duckdb", "clickhouse", "trino", "cassandra", "elasticsearch", "redis", "neo4j", "mongodb"]);

const safeDecode = (s: string): string => { try { return decodeURIComponent(s); } catch { return s; } };
const dec = (s: string): string => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
const truthy = (v: string | undefined): boolean => v !== undefined && ["true", "1", "yes", "on", "required", "require"].includes(v.toLowerCase());
const falsy = (v: string | undefined): boolean => v !== undefined && ["false", "0", "no", "off", "disabled", "disable"].includes(v.toLowerCase());

/** `a=1&b=2` or `a=1;b=2` into a case-insensitive map. */
function params(text: string | undefined, sep: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (text ?? "").split(sep)) {
    if (!part.trim()) continue;
    const eq = part.indexOf("=");
    out.set((eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase(), eq < 0 ? "" : dec(part.slice(eq + 1).trim()));
  }
  return out;
}

/** The first of these parameters that is present, removing every name it looked at from `unused`. */
function take(p: Map<string, string>, unused: Set<string>, ...names: string[]): string | undefined {
  let found: string | undefined;
  for (const n of names) { unused.delete(n); if (found === undefined && p.has(n)) found = p.get(n); }
  return found;
}

interface Authority { user?: string; password?: string; host: string; port?: number; rest: string; hostCount: number }
/** `[user[:password]@]host[:port][,more hosts]` followed by the rest of the URL (path, query). */
function authority(afterSlashes: string): Authority {
  const slash = afterSlashes.search(/[/?;#]/);
  const head = slash < 0 ? afterSlashes : afterSlashes.slice(0, slash), rest = slash < 0 ? "" : afterSlashes.slice(slash);
  const at = head.lastIndexOf("@");
  const cred = at < 0 ? "" : head.slice(0, at), hostPart = at < 0 ? head : head.slice(at + 1);
  const hosts = hostPart.split(",").map((h) => h.trim()).filter(Boolean);
  const first = hosts[0] ?? "";
  let host = first, port: number | undefined;
  const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(first);
  if (v6) { host = v6[1]!; if (v6[2]) port = Number(v6[2]); }
  else { const m = /^(.*):(\d+)$/.exec(first); if (m) { host = m[1]!; port = Number(m[2]); } }
  const colon = cred.indexOf(":");
  return { ...(cred ? { user: dec(colon < 0 ? cred : cred.slice(0, colon)), ...(colon < 0 ? {} : { password: dec(cred.slice(colon + 1)) }) } : {}), host, ...(port !== undefined ? { port } : {}), rest, hostCount: hosts.length };
}

function finish(driver: string, values: JdbcConnection["values"], secretKeys: string[], notes: JdbcConnection["notes"], unused: Set<string>, label: string): JdbcConnection {
  for (const k of Object.keys(values)) if (values[k] === undefined || values[k] === "") delete values[k];
  if (values["password"] !== undefined) { secretKeys.push("password"); notes.push({ template: NOTE_PASSWORD }); }
  if (unused.size) notes.push({ template: NOTE_IGNORED, args: [[...unused].sort().join(", ")] });
  return { driver, values, secretKeys, notes, name: label };
}

const label = (host: string, db?: string): string => `${host}${db ? `/${db}` : ""}`;

function parseOracle(rest: string): JdbcConnection {
  // rest: "oracle:thin:[user/password]@target"
  const m = /^oracle:(thin|oci\d*|kprb):(.*)$/is.exec(rest);
  if (!m) throw new JdbcUrlError(ERR_MALFORMED, ["expected jdbc:oracle:thin:@…"]);
  if (m[1]!.toLowerCase() !== "thin") throw new JdbcUrlError(ERR_ORACLE_OCI);
  const body = m[2]!, at = body.indexOf("@");
  if (at < 0) throw new JdbcUrlError(ERR_MALFORMED, ["missing @"]);
  const cred = body.slice(0, at), target = body.slice(at + 1).trim();
  const values: JdbcConnection["values"] = {};
  const notes: JdbcConnection["notes"] = [];
  if (cred) { const slash = cred.indexOf("/"); values["user"] = dec(slash < 0 ? cred : cred.slice(0, slash)); if (slash >= 0) values["password"] = dec(cred.slice(slash + 1)); }
  if (/^\(/.test(target)) {
    // (DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=h)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=s)))
    const up = target.toUpperCase();
    const addrs = up.match(/\(ADDRESS\s*=/g)?.length ?? 0;
    const pick = (re: RegExp) => { const x = re.exec(target); return x ? x[1]!.trim() : undefined; };
    const proto = pick(/\(\s*PROTOCOL\s*=\s*([A-Za-z]+)\s*\)/i);
    if (proto && proto.toUpperCase() === "TCPS") throw new JdbcUrlError(ERR_ORACLE_TCPS);
    const host = pick(/\(\s*HOST\s*=\s*([^)\s]+)\s*\)/i), port = pick(/\(\s*PORT\s*=\s*(\d+)\s*\)/i);
    if (!host) throw new JdbcUrlError(ERR_MALFORMED, ["the DESCRIPTION has no HOST"]);
    values["host"] = host; values["port"] = port ? Number(port) : 1521;
    const service = pick(/\(\s*SERVICE_NAME\s*=\s*([^)\s]+)\s*\)/i), sid = pick(/\(\s*SID\s*=\s*([^)\s]+)\s*\)/i);
    if (service) values["service"] = service; else if (sid) values["sid"] = sid;
    if (addrs > 1) notes.push({ template: NOTE_ORACLE_FIRST, args: [String(addrs)] });
    return finish("oracle", values, [], notes, new Set(), label(host, service ?? sid));
  }
  let t = target;
  if (/^tcps:/i.test(t)) throw new JdbcUrlError(ERR_ORACLE_TCPS);
  t = t.replace(/^tcp:/i, "");
  let host: string, port: number | undefined, service: string | undefined, sid: string | undefined;
  if (t.startsWith("//")) {
    // //host[:port][/service]
    const a = authority(t.slice(2));
    host = a.host; port = a.port; service = dec(a.rest.replace(/^\//, "").replace(/[?;].*$/, "")) || undefined;
  } else {
    // host:port:SID  |  host:port/service  |  host/service  |  alias
    const sidForm = /^([^:/]+):(\d+):([^:/]+)$/.exec(t), svcForm = /^([^:/]+)(?::(\d+))?\/(.+)$/.exec(t);
    if (sidForm) { host = sidForm[1]!; port = Number(sidForm[2]); sid = sidForm[3]!; }
    else if (svcForm) { host = svcForm[1]!; if (svcForm[2]) port = Number(svcForm[2]); service = svcForm[3]!; }
    else if (/^[A-Za-z0-9_.-]+$/.test(t)) throw new JdbcUrlError(ERR_ORACLE_TNS);
    else throw new JdbcUrlError(ERR_MALFORMED, ["unrecognised Oracle target"]);
  }
  if (!host) throw new JdbcUrlError(ERR_MALFORMED, ["no host"]);
  values["host"] = host; values["port"] = port ?? 1521;
  if (service) values["service"] = service; if (sid) values["sid"] = sid;
  return finish("oracle", values, [], notes, new Set(), label(host, service ?? sid));
}

function sslFlags(values: JdbcConnection["values"], notes: JdbcConnection["notes"], kind: "pg" | "mysql" | "mariadb", p: Map<string, string>, unused: Set<string>): void {
  if (kind === "pg") {
    const mode = take(p, unused, "sslmode")?.toLowerCase(), ssl = take(p, unused, "ssl");
    take(p, unused, "sslrootcert", "sslcert", "sslkey", "sslfactory");
    const root = p.get("sslrootcert");
    if (root) values["sslCaFile"] = root;
    if (mode === "disable") values["ssl"] = false;
    else if (mode || truthy(ssl)) values["ssl"] = true;
    else if (falsy(ssl)) values["ssl"] = false;
    if (mode === "require" || mode === "prefer" || mode === "allow") notes.push({ template: NOTE_PREFER });
    return;
  }
  const mode = take(p, unused, "sslmode")?.toLowerCase(), use = take(p, unused, "usessl", "requiressl");
  const verify = take(p, unused, "verifyservercertificate", "trustservercertificate");
  if (mode) {
    if (["disabled", "disable"].includes(mode)) values["ssl"] = false;
    else { values["ssl"] = true; if (mode === "trust") values["sslVerify"] = false; }
  } else if (truthy(use)) values["ssl"] = true;
  else if (falsy(use)) values["ssl"] = false;
  if (kind === "mysql" && falsy(verify)) values["sslVerify"] = false;
  if (kind === "mariadb" && truthy(p.get("trustservercertificate"))) values["sslVerify"] = false;
}

/** `jdbc:<sub>://[user:pass@]host[:port][/path][?query]` for the engines that share this shape. */
function parseHostUrl(rest: string, sub: string, defaults: { port: number; driver: string }): JdbcConnection {
  const body = rest.slice(sub.length + 1);
  const afterScheme = body.startsWith("//") ? body.slice(2) : (() => { throw new JdbcUrlError(ERR_MALFORMED, [`expected jdbc:${sub}://host…`]); })();
  const a = authority(afterScheme);
  if (!a.host && defaults.driver === "postgres") a.host = "localhost";   // jdbc:postgresql:///db means this machine
  if (!a.host) throw new JdbcUrlError(ERR_MALFORMED, ["no host"]);
  const q = a.rest.indexOf("?");
  const path = safeDecode((q < 0 ? a.rest : a.rest.slice(0, q)).replace(/^\//, "").replace(/;.*$/, "") || "");
  const p = params(q < 0 ? (a.rest.includes(";") ? a.rest.slice(a.rest.indexOf(";") + 1) : "") : a.rest.slice(q + 1), /[&;]/);
  const unused = new Set(p.keys()), notes: JdbcConnection["notes"] = [];
  const values: JdbcConnection["values"] = { host: a.host, port: a.port ?? defaults.port };
  const user = take(p, unused, "user", "username") ?? a.user, password = take(p, unused, "password", "pwd") ?? a.password;
  if (user) values["user"] = user; if (password) values["password"] = password;
  if (a.hostCount > 1) notes.push({ template: NOTE_ORACLE_FIRST, args: [String(a.hostCount)] });

  switch (defaults.driver) {
    case "postgres": {
      if (path) values["database"] = path;
      unused.delete("currentschema"); take(p, unused, "applicationname", "connecttimeout", "sockettimeout", "loglevel", "targetservertype", "loadbalancehosts", "preferqueryresult", "readonly");
      sslFlags(values, notes, "pg", p, unused);
      break;
    }
    case "mysql": {
      if (path) values["database"] = path;
      sslFlags(values, notes, sub === "mariadb" ? "mariadb" : "mysql", p, unused);
      for (const k of ["servertimezone", "characterencoding", "allowpublickeyretrieval", "autoreconnect", "connecttimeout", "sockettimeout", "usesslverification", "usecompression", "useunicode", "zerodatetimebehavior", "rewritebatchedstatements", "allowmultiqueries", "usernamesaslowercase", "tcpkeepalive", "connectiontimezone"]) unused.delete(k);
      break;
    }
    case "clickhouse": {
      if (path) values["database"] = path;
      const ssl = take(p, unused, "ssl", "secure"); take(p, unused, "sslmode", "protocol", "compress", "socket_timeout", "connect_timeout", "database");
      if (truthy(ssl) || p.get("protocol")?.toLowerCase() === "https") { values["ssl"] = true; if (a.port === undefined) values["port"] = 8443; }
      if (!path && p.get("database")) values["database"] = p.get("database")!;
      if (p.get("sslmode")?.toLowerCase() === "none") values["sslVerify"] = false;
      break;
    }
    case "trino": {
      const [catalog, schema] = path.split("/");
      if (catalog) values["catalog"] = catalog; if (schema) values["schema"] = schema;
      const ssl = take(p, unused, "ssl"); const verification = take(p, unused, "sslverification");
      take(p, unused, "source", "clienttags", "timezone", "extracredentials", "accesstoken", "applicationnameprefix");
      if (truthy(ssl)) { values["ssl"] = true; if (a.port === undefined) values["port"] = 443; }
      if (verification?.toUpperCase() === "NONE") values["sslVerify"] = false;
      break;
    }
    case "cassandra": {
      if (path) values["keyspace"] = path;
      const dc = take(p, unused, "localdatacenter", "localdc"); if (dc) values["localDataCenter"] = dc;
      const ssl = take(p, unused, "enablessl", "ssl"); if (truthy(ssl)) values["ssl"] = true;
      take(p, unused, "consistency", "requesttimeout", "connecttimeout");
      break;
    }
    case "redis": {
      if (/^\d+$/.test(path)) values["database"] = Number(path);
      const ssl = take(p, unused, "ssl", "tls"); if (truthy(ssl)) values["ssl"] = true;
      take(p, unused, "timeout", "database");
      if (!path && p.get("database") && /^\d+$/.test(p.get("database")!)) values["database"] = Number(p.get("database"));
      break;
    }
    case "neo4j": {
      if (path) values["database"] = path;
      const secure = /\+s(sc)?$/i.test(sub) || truthy(take(p, unused, "ssl", "encryption", "encrypted"));
      if (secure) values["ssl"] = true;
      values["port"] = secure ? 7473 : 7474;
      notes.push({ template: NOTE_NEO4J_PORT });
      break;
    }
    default: break;
  }
  return finish(defaults.driver, values, [], notes, unused, label(a.host, String(values["database"] ?? values["catalog"] ?? values["keyspace"] ?? "")));
}

function parseSqlServer(rest: string): JdbcConnection {
  // jdbc:sqlserver://host[\instance][:port][;name=value;...]
  const body = rest.replace(/^sqlserver:/i, "");
  if (!body.startsWith("//")) throw new JdbcUrlError(ERR_MALFORMED, ["expected jdbc:sqlserver://host…"]);
  const semi = body.indexOf(";");
  const hostPart = semi < 0 ? body.slice(2) : body.slice(2, semi);
  const p = params(semi < 0 ? "" : body.slice(semi + 1), /;/);
  const unused = new Set(p.keys()), notes: JdbcConnection["notes"] = [];
  const m = /^(?:\[([^\]]+)\]|([^\\:]*))(?:\\([^:]+))?(?::(\d+))?$/.exec(hostPart.trim());
  if (!m) throw new JdbcUrlError(ERR_MALFORMED, ["bad host"]);
  const host = m[1] ?? m[2] ?? "";
  if (!host) throw new JdbcUrlError(ERR_MALFORMED, ["no host"]);
  const instance = m[3] ?? take(p, unused, "instancename");
  if (instance) { unused.delete("instancename"); notes.push({ template: NOTE_MSSQL_INSTANCE }); }
  const port = m[4] ?? take(p, unused, "portnumber");
  if (truthy(take(p, unused, "integratedsecurity")) || /ntlm|kerberos|activedirectory/i.test(p.get("authentication") ?? "")) throw new JdbcUrlError(ERR_INTEGRATED);
  take(p, unused, "authentication");
  const values: JdbcConnection["values"] = { host, port: port ? Number(port) : 1433 };
  const db = take(p, unused, "databasename", "database"); if (db) values["database"] = db;
  const user = take(p, unused, "user", "username"), password = take(p, unused, "password"); if (user) values["user"] = user; if (password) values["password"] = password;
  const enc = take(p, unused, "encrypt"); if (truthy(enc) || enc?.toLowerCase() === "strict") values["ssl"] = true; else if (falsy(enc)) values["ssl"] = false;
  if (truthy(take(p, unused, "trustservercertificate"))) values["sslVerify"] = false;
  take(p, unused, "applicationname", "logintimeout", "sockettimeout", "loginTimeout".toLowerCase(), "multisubnetfailover", "applicationintent", "sendstringparametersasunicode", "selectmethod", "hostnameincertificate", "truststore", "truststorepassword", "queryTimeout".toLowerCase(), "lockTimeout".toLowerCase(), "packetsize");
  return finish("mssql", values, [], notes, unused, label(host, db));
}

function parseFilePath(rest: string, sub: "sqlite" | "duckdb"): JdbcConnection {
  let path = rest.slice(sub.length + 1);
  const notes: JdbcConnection["notes"] = [], unused = new Set<string>();
  const cut = path.search(/[?;]/);
  if (cut >= 0) { for (const k of params(path.slice(cut + 1), /[&;]/).keys()) unused.add(k); path = path.slice(0, cut); }
  path = dec(path.replace(/^file:/i, "")).trim();
  if (!path || path === ":memory:" || path === "memory:") path = ":memory:";
  return finish(sub, { path }, [], notes, unused, path === ":memory:" ? sub : (path.split(/[\\/]/).pop() ?? sub));
}

function parseElastic(rest: string, sub: string): JdbcConnection {
  // jdbc:es://[http|https://]host[:port][/prefix]?options   (also jdbc:elasticsearch:// and jdbc:opensearch://)
  let body = rest.slice(sub.length + 1);
  if (!body.startsWith("//")) throw new JdbcUrlError(ERR_MALFORMED, [`expected jdbc:${sub}://host…`]);
  body = body.slice(2);
  let scheme: "http" | "https" | undefined;
  const sm = /^(https?):\/\//i.exec(body);
  if (sm) { scheme = sm[1]!.toLowerCase() as "http" | "https"; body = body.slice(sm[0].length); }
  const a = authority(body);
  if (!a.host) throw new JdbcUrlError(ERR_MALFORMED, ["no host"]);
  const q = a.rest.indexOf("?"), p = params(q < 0 ? "" : a.rest.slice(q + 1), /[&;]/);
  const unused = new Set(p.keys()), notes: JdbcConnection["notes"] = [];
  const values: JdbcConnection["values"] = { host: a.host, port: a.port ?? 9200 };
  const user = take(p, unused, "user", "username") ?? a.user, password = take(p, unused, "password") ?? a.password;
  if (user) values["user"] = user; if (password) values["password"] = password;
  const ssl = take(p, unused, "ssl", "usessl");
  if (scheme === "https" || truthy(ssl)) values["ssl"] = true; else if (scheme === "http" || falsy(ssl)) values["ssl"] = false;
  if (truthy(take(p, unused, "trustselfsigned")) || falsy(take(p, unused, "hostnameverification"))) values["sslVerify"] = false;
  take(p, unused, "auth", "timeout", "region");
  return finish("elasticsearch", values, [], notes, unused, label(a.host));
}

/** Reads a JDBC URL. Throws {@link JdbcUrlError} for anything it cannot turn into a connection. */
export function parseJdbcUrl(raw: string): JdbcConnection {
  try { return parse(raw); } catch (e) { throw e instanceof JdbcUrlError ? e : new JdbcUrlError(ERR_MALFORMED, [e instanceof Error ? e.message : "unexpected input"]); }
}

function parse(raw: string): JdbcConnection {
  const text = raw.trim();
  if (!/^jdbc:/i.test(text)) throw new JdbcUrlError(ERR_NOT_JDBC);
  const rest = text.slice(5);
  const sub = /^([a-z0-9]+(?:\+[a-z]+)?)/i.exec(rest)?.[1]?.toLowerCase() ?? "";
  switch (sub) {
    case "oracle": return parseOracle(rest);
    case "postgresql": case "yugabytedb": case "pgsql": case "cockroachdb": return parseHostUrlOrShort(rest, sub, { port: 5432, driver: "postgres" });
    case "mysql": return parseHostUrl(rest, sub, { port: 3306, driver: "mysql" });
    case "mariadb": return parseHostUrl(rest, sub, { port: 3306, driver: "mysql" });
    case "sqlserver": return parseSqlServer(rest);
    case "sqlite": return parseFilePath(rest, "sqlite");
    case "duckdb": return parseFilePath(rest, "duckdb");
    case "clickhouse": case "ch": return parseHostUrl(rest.replace(/^(clickhouse|ch):(https?):/i, "$1:"), sub, { port: 8123, driver: "clickhouse" });
    case "trino": case "presto": return parseHostUrl(rest, sub, { port: 8080, driver: "trino" });
    case "cassandra": return parseHostUrl(rest.replace(/--/g, ","), sub, { port: 9042, driver: "cassandra" });
    case "es": case "elasticsearch": case "opensearch": return parseElastic(rest, sub);
    case "redis": case "valkey": return parseHostUrl(rest, sub, { port: 6379, driver: "redis" });
    case "neo4j": case "neo4j+s": case "neo4j+ssc": return parseHostUrl(rest.replace(/^neo4j(\+s{1,2}c?)?:bolt:/i, (m0, s) => `neo4j${s ?? ""}:`), sub, { port: 7687, driver: "neo4j" });
    case "mongodb": case "mongodb+srv": {
      const uri = text.slice(5);
      const u = (() => { try { return new URL(uri.replace(/^mongodb\+srv:/, "mongodb:")); } catch { throw new JdbcUrlError(ERR_MALFORMED, ["bad MongoDB URI"]); } })();
      return { driver: "mongodb", values: { uri, ...(u.pathname.length > 1 ? { database: dec(u.pathname.slice(1)) } : {}) }, secretKeys: ["uri"], notes: [{ template: NOTE_MONGO_URI }], name: u.hostname };
    }
    default: throw new JdbcUrlError(ERR_UNSUPPORTED, [sub || rest.split(":")[0] || ""]);
  }
}

/** PostgreSQL also has the short forms `jdbc:postgresql:database` and `jdbc:postgresql:/` (localhost). */
function parseHostUrlOrShort(rest: string, sub: string, defaults: { port: number; driver: string }): JdbcConnection {
  const body = rest.slice(sub.length + 1);
  if (body.startsWith("//")) return parseHostUrl(rest, sub, defaults);
  const q = body.indexOf("?");
  const db = safeDecode((q < 0 ? body : body.slice(0, q)).replace(/^\/?/, ""));
  const p = params(q < 0 ? "" : body.slice(q + 1), /[&;]/);
  const unused = new Set(p.keys()), notes: JdbcConnection["notes"] = [];
  const values: JdbcConnection["values"] = { host: "localhost", port: defaults.port };
  if (db) values["database"] = db;
  const user = take(p, unused, "user"), password = take(p, unused, "password"); if (user) values["user"] = user; if (password) values["password"] = password;
  sslFlags(values, notes, "pg", p, unused);
  return finish("postgres", values, [], notes, unused, label("localhost", db));
}

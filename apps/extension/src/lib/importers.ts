
/** English source of the notes the importers attach; the UI translates them by these exact strings. */
export const NOTE_MONGO_URI = "The connection string is stored as a secret because it may contain credentials.";
export const NOTE_SSLMODE = "sslmode=require only encrypts here: certificates are verified. Turn off “Verify server certificate” if the server uses a private CA you cannot add.";
export const NOTE_DBEAVER = "DBeaver keeps user names and passwords in an encrypted file; they were not imported. Enter them when you first connect.";
/** Parsers that turn other tools' connection files into RizomaDB connections. Secrets are returned separately so the caller can ask before storing them. */

export interface ImportedConnection {
  name: string;
  driver: "postgres" | "mysql" | "mssql" | "oracle" | "sqlite" | "mongodb" | "redis" | "clickhouse" | "elasticsearch";
  options: Record<string, unknown>;
  /** Plain-text secrets found in the source (never written anywhere without consent). */
  secrets: Record<string, string>;
  notes: string[];
}

const SCHEMES: Record<string, { driver: ImportedConnection["driver"]; port: number; tls?: boolean }> = {
  postgres: { driver: "postgres", port: 5432 }, postgresql: { driver: "postgres", port: 5432 },
  mysql: { driver: "mysql", port: 3306 }, mariadb: { driver: "mysql", port: 3306 },
  sqlserver: { driver: "mssql", port: 1433 }, mssql: { driver: "mssql", port: 1433 },
  oracle: { driver: "oracle", port: 1521 },
  mongodb: { driver: "mongodb", port: 27017 }, "mongodb+srv": { driver: "mongodb", port: 27017 },
  redis: { driver: "redis", port: 6379 }, rediss: { driver: "redis", port: 6379, tls: true },
  clickhouse: { driver: "clickhouse", port: 8123 }, http: { driver: "elasticsearch", port: 9200 }, https: { driver: "elasticsearch", port: 9200, tls: true },
  sqlite: { driver: "sqlite", port: 0 },
};

const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** postgres://user:pass@host:5432/db?sslmode=require and friends. */
export function parseConnectionUri(raw: string, name?: string): ImportedConnection {
  const text = raw.trim().replace(/^jdbc:/i, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1]?.toLowerCase();
  const spec = scheme ? SCHEMES[scheme] : undefined;
  if (!scheme || !spec) throw new Error(`Unsupported or malformed connection string (scheme "${scheme ?? ""}")`);
  const notes: string[] = [];
  if (spec.driver === "sqlite") { const p = dec(text.replace(/^sqlite:(\/\/)?/i, "")); return { name: name ?? p.split("/").pop() ?? "SQLite", driver: "sqlite", options: { path: p }, secrets: {}, notes }; }
  if (spec.driver === "mongodb") {
    // The whole URI carries the password (and SRV hosts): keep it as a single secret, show a redacted label.
    const u = new URL(text.replace(/^mongodb\+srv:/, "mongodb:"));
    return { name: name ?? u.hostname, driver: "mongodb", options: { database: dec(u.pathname.slice(1)) || undefined }, secrets: { uri: raw.trim() }, notes: [NOTE_MONGO_URI] };
  }
  let u: URL;
  try { u = new URL(text.replace(/^[a-z][a-z0-9+.-]*:/i, "http:")); } catch { throw new Error("Malformed connection string"); }
  const q = u.searchParams;
  const sslmode = (q.get("sslmode") ?? q.get("ssl") ?? q.get("encrypt") ?? "").toLowerCase();
  const ssl = spec.tls || ["require", "verify-ca", "verify-full", "true", "1", "prefer"].includes(sslmode);
  const secrets: Record<string, string> = {};
  if (u.password) secrets.password = dec(u.password);
  else if (q.get("password")) secrets.password = q.get("password")!;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const database = dec(u.pathname.replace(/^\//, ""));
  const options: Record<string, unknown> = { host, port: u.port ? Number(u.port) : spec.port, ...(u.username || q.get("user") ? { user: dec(u.username) || q.get("user") } : {}), ...(database ? (spec.driver === "oracle" ? { service: database } : { database }) : {}), ssl };
  if (sslmode === "require" || sslmode === "prefer") notes.push(NOTE_SSLMODE);
  if (spec.driver === "redis" && /^\d+$/.test(database)) options.database = Number(database);
  return { name: name ?? `${host}${database ? "/" + database : ""}`, driver: spec.driver, options, secrets, notes };
}

/** ~/.pgpass: host:port:database:user:password, with `\:` and `\\` escapes. Wildcards (*) are kept out of the import. */
export function parsePgpass(text: string): ImportedConnection[] {
  const out: ImportedConnection[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith("#")) continue;
    const parts: string[] = []; let cur = "";
    for (let i = 0; i < line.length; i++) { const c = line[i]!; if (c === "\\" && (line[i + 1] === ":" || line[i + 1] === "\\")) { cur += line[++i]; continue; } if (c === ":" && parts.length < 4) { parts.push(cur); cur = ""; continue; } cur += c; }
    parts.push(cur);
    if (parts.length !== 5) continue;
    const [host, port, database, user, password] = parts as [string, string, string, string, string];
    if (host === "*") continue;
    out.push({ name: `${user}@${host}${database !== "*" ? "/" + database : ""}`, driver: "postgres", options: { host, port: port === "*" ? 5432 : Number(port), ...(database !== "*" ? { database } : {}), ...(user !== "*" ? { user } : {}), ssl: true }, secrets: { password }, notes: ["Imported from .pgpass."] });
  }
  return out;
}

/** ~/.my.cnf style files: the [client] section. */
export function parseMyCnf(text: string): ImportedConnection[] {
  const sections = new Map<string, Record<string, string>>(); let cur = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const s = /^\[(.+)\]$/.exec(line); if (s) { cur = s[1]!.toLowerCase(); sections.set(cur, sections.get(cur) ?? {}); continue; }
    const kv = /^([A-Za-z_-]+)\s*(?:=\s*(.*))?$/.exec(line); if (!kv || !cur) continue;
    sections.get(cur)![kv[1]!.toLowerCase().replaceAll("-", "_")] = (kv[2] ?? "").replace(/^["']|["']$/g, "");
  }
  const out: ImportedConnection[] = [];
  for (const [name, c] of sections) {
    if (!["client", "mysql", "mysqldump"].includes(name) || !(c.host || c.user || c.socket)) continue;
    out.push({ name: `${c.user ?? "mysql"}@${c.host ?? "localhost"}`, driver: "mysql", options: { host: c.host ?? "localhost", port: Number(c.port ?? 3306), ...(c.user ? { user: c.user } : {}), ...(c.database ? { database: c.database } : {}), ssl: !!(c.ssl_mode && c.ssl_mode !== "DISABLED") }, secrets: c.password ? { password: c.password } : {}, notes: c.socket ? ["A socket path was set; RizomaDB connects over TCP."] : [] });
  }
  return out;
}

const DBEAVER_DRIVERS: Record<string, ImportedConnection["driver"]> = { "postgres-jdbc": "postgres", postgresql: "postgres", mysql8: "mysql", mysql5: "mysql", mariaDB: "mysql", mariadb: "mysql", sqlserver: "mssql", mssql: "mssql", jtds_sqlserver: "mssql", oracle_thin: "oracle", sqlite_jdbc: "sqlite", clickhouse: "clickhouse" };

/** DBeaver `.dbeaver/data-sources.json`. Credentials live in an encrypted file and are deliberately not read. */
export function parseDBeaver(json: unknown): ImportedConnection[] {
  const conns = (json as { connections?: Record<string, { name?: string; provider?: string; driver?: string; configuration?: { host?: string; port?: string; database?: string; url?: string; type?: string; "auth-model"?: string } }> })?.connections ?? {};
  const out: ImportedConnection[] = [];
  for (const c of Object.values(conns)) {
    const driver = DBEAVER_DRIVERS[c.driver ?? ""]; const cfg = c.configuration ?? {};
    if (!driver) continue;
    const notes = [NOTE_DBEAVER];
    if (driver === "sqlite") { const p = (cfg.database ?? cfg.url ?? "").replace(/^jdbc:sqlite:/, ""); if (p) out.push({ name: c.name ?? p, driver, options: { path: p }, secrets: {}, notes: [] }); continue; }
    const portDefault = SCHEMES[driver === "postgres" ? "postgres" : driver === "mssql" ? "mssql" : driver]?.port;
    if (!cfg.host && cfg.url) { try { const p = parseConnectionUri(cfg.url, c.name); out.push({ ...p, secrets: {}, notes: [...p.notes, ...notes] }); } catch { /* unsupported JDBC form */ } continue; }
    out.push({ name: c.name ?? cfg.host ?? driver, driver, options: { host: cfg.host ?? "localhost", port: cfg.port ? Number(cfg.port) : portDefault, ...(cfg.database ? (driver === "oracle" ? { service: cfg.database } : { database: cfg.database }) : {}), ssl: false }, secrets: {}, notes });
  }
  return out;
}

const SQLTOOLS_DRIVERS: Record<string, ImportedConnection["driver"]> = { postgresql: "postgres", mysql: "mysql", mariadb: "mysql", mssql: "mssql", "microsoft sql server": "mssql", oracle: "oracle", sqlite: "sqlite", clickhouse: "clickhouse" };

/** SQLTools `sqltools.connections` from a settings.json (comments and trailing commas tolerated). */
export function parseSqlTools(settingsText: string): ImportedConnection[] {
  const clean = settingsText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1").replace(/,(\s*[}\]])/g, "$1");
  let json: { "sqltools.connections"?: Record<string, unknown>[] };
  try { json = JSON.parse(clean); } catch (e) { throw new Error(`settings.json could not be read: ${(e as Error).message}`, { cause: e }); }
  const out: ImportedConnection[] = [];
  for (const c of json["sqltools.connections"] ?? []) {
    const driver = SQLTOOLS_DRIVERS[String(c.driver ?? "").toLowerCase()]; if (!driver) continue;
    const notes: string[] = [];
    const secrets: Record<string, string> = {};
    if (typeof c.password === "string" && c.password) { secrets.password = c.password; notes.push("SQLTools stored this password in plain text in settings.json; consider removing it there."); }
    if (driver === "sqlite") { out.push({ name: String(c.name ?? c.database), driver, options: { path: String(c.database ?? "") }, secrets: {}, notes }); continue; }
    out.push({ name: String(c.name ?? c.server), driver, options: { host: String(c.server ?? "localhost"), port: Number(c.port ?? SCHEMES[driver === "postgres" ? "postgres" : driver]?.port ?? 0), ...(c.database ? (driver === "oracle" ? { service: String(c.database) } : { database: String(c.database) }) : {}), ...(c.username ? { user: String(c.username) } : {}), ssl: !!c.ssl }, secrets, notes });
  }
  return out;
}

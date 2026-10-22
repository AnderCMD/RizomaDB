/**
 * Statements that create a database account limited to reading, so a connection can have a server-side read-only guarantee.
 * RizomaDB only writes the script; an administrator reviews and runs it. Only engines whose script was run against a real server are offered.
 */
export const PASSWORD_PLACEHOLDER = "<choose-a-password>";

export const READ_ONLY_USER_ENGINES = ["postgres", "mysql", "mariadb", "clickhouse", "redis"] as const;
export type ReadOnlyUserEngine = (typeof READ_ONLY_USER_ENGINES)[number];
export const supportsReadOnlyUser = (engine: string): engine is ReadOnlyUserEngine => (READ_ONLY_USER_ENGINES as readonly string[]).includes(engine);

export class ReadOnlyUserError extends Error {}

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const dq = (s: string) => `"${s.replaceAll('"', '""')}"`;
const bq = (s: string) => `\`${s.replaceAll("`", "``")}\``;
const hasControl = (s: string) => [...s].some((ch) => ch.charCodeAt(0) < 32);
const sq = (s: string) => `'${s.replaceAll("'", "''")}'`;

export interface ReadOnlyUserOptions { user: string; database?: string; schema?: string }

/** One statement per entry, without a trailing semicolon. Throws ReadOnlyUserError for names that cannot be used safely. */
export function readOnlyUserStatements(engine: ReadOnlyUserEngine, o: ReadOnlyUserOptions): string[] {
  if (!NAME.test(o.user)) throw new ReadOnlyUserError("user");
  const db = o.database?.trim() ?? "";
  if (hasControl(db) || (engine !== "redis" && !db)) throw new ReadOnlyUserError("database");
  const schema = o.schema?.trim() || "public";
  if (hasControl(schema)) throw new ReadOnlyUserError("schema");
  const pw = PASSWORD_PLACEHOLDER;
  switch (engine) {
    case "postgres": return [
      `CREATE ROLE ${dq(o.user)} LOGIN PASSWORD ${sq(pw)}`,
      `ALTER ROLE ${dq(o.user)} SET default_transaction_read_only = on`,
      `GRANT CONNECT ON DATABASE ${dq(db)} TO ${dq(o.user)}`,
      `GRANT USAGE ON SCHEMA ${dq(schema)} TO ${dq(o.user)}`,
      `GRANT SELECT ON ALL TABLES IN SCHEMA ${dq(schema)} TO ${dq(o.user)}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${dq(schema)} GRANT SELECT ON TABLES TO ${dq(o.user)}`,
    ];
    case "mysql": case "mariadb": return [
      `CREATE USER ${sq(o.user)}@'%' IDENTIFIED BY ${sq(pw)}`,
      `GRANT SELECT, SHOW VIEW ON ${bq(db)}.* TO ${sq(o.user)}@'%'`,
    ];
    case "clickhouse": return [
      `CREATE USER ${bq(o.user)} IDENTIFIED BY ${sq(pw)} SETTINGS readonly = 2`,
      `GRANT SELECT ON ${bq(db)}.* TO ${bq(o.user)}`,
    ];
    case "redis": return [`ACL SETUSER ${o.user} on >${pw} ~* &* -@all +@read +ping +info`];
  }
}

/** The text to open in an editor: a short note, then the statements. Redis commands are one per line and carry no comment syntax. */
export function readOnlyUserScript(engine: ReadOnlyUserEngine, o: ReadOnlyUserOptions, note: string): { language: "sql" | "plaintext"; text: string } {
  const statements = readOnlyUserStatements(engine, o);
  if (engine === "redis") return { language: "plaintext", text: `${statements.join("\n")}\n` };
  return { language: "sql", text: `-- ${note}\n${statements.map((s) => `${s};`).join("\n")}\n` };
}

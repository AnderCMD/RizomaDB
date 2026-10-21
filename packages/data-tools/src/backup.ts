import { spawn } from "node:child_process";
import { accessSync, constants, createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { ResolvedConnectionConfig } from "@rizomadb/driver-api";

/** Looks a tool up on PATH (plus optional extra directories). Tools are detected, never bundled. */
export function findTool(name: string, extraDirs: string[] = [], env: Record<string, string | undefined> = process.env): string | undefined {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const dir of [...extraDirs, ...(env.PATH ?? "").split(delimiter)]) {
    for (const e of exts) { const p = join(dir, name + e); try { accessSync(p, constants.X_OK); return p; } catch { /* next */ } }
  }
  return undefined;
}

export interface ToolSpec { command: string; args: string[]; env: Record<string, string>; stdinFile?: string; stdoutFile?: string; cleanup(): Promise<void> }

const str = (v: unknown, d = "") => (v === undefined || v === null ? d : String(v));

/** Secrets travel through the environment or a 0600 temp file, never through argv (visible in `ps`). */
async function mysqlDefaults(cfg: ResolvedConnectionConfig) {
  const dir = await mkdtemp(join(tmpdir(), "rz-my-"));
  const file = join(dir, "client.cnf");
  const esc = (s: string) => s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  await writeFile(file, `[client]\nuser="${esc(str(cfg.user))}"\n${cfg.password !== undefined ? `password="${esc(str(cfg.password))}"\n` : ""}host="${esc(str(cfg.host, "localhost"))}"\nport=${Number(cfg.port ?? 3306)}\n`, { mode: 0o600 });
  return { file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export type BackupEngine = "postgres" | "mysql";

export async function backupSpec(engine: BackupEngine, cfg: ResolvedConnectionConfig, file: string, tools: Partial<Record<string, string>> = {}): Promise<ToolSpec> {
  if (engine === "postgres") {
    const cmd = tools.pg_dump ?? findTool("pg_dump"); if (!cmd) throw new Error("pg_dump was not found on PATH. Install the PostgreSQL client tools.");
    return { command: cmd, args: ["-Fc", "-h", str(cfg.host, "localhost"), "-p", String(cfg.port ?? 5432), "-U", str(cfg.user), "-d", str(cfg.database), "-f", file, "--no-password"], env: pgEnv(cfg), cleanup: async () => {} };
  }
  const cmd = tools.mysqldump ?? findTool("mysqldump"); if (!cmd) throw new Error("mysqldump was not found on PATH. Install the MySQL/MariaDB client tools.");
  const d = await mysqlDefaults(cfg);
  return { command: cmd, args: [`--defaults-extra-file=${d.file}`, "--single-transaction", "--routines", "--triggers", `--result-file=${file}`, str(cfg.database)], env: {}, cleanup: d.cleanup };
}

export async function restoreSpec(engine: BackupEngine, cfg: ResolvedConnectionConfig, file: string, tools: Partial<Record<string, string>> = {}): Promise<ToolSpec> {
  if (engine === "postgres") {
    const cmd = tools.pg_restore ?? findTool("pg_restore"); if (!cmd) throw new Error("pg_restore was not found on PATH. Install the PostgreSQL client tools.");
    return { command: cmd, args: ["--clean", "--if-exists", "--no-owner", "-h", str(cfg.host, "localhost"), "-p", String(cfg.port ?? 5432), "-U", str(cfg.user), "-d", str(cfg.database), "--no-password", file], env: pgEnv(cfg), cleanup: async () => {} };
  }
  const cmd = tools.mysql ?? findTool("mysql") ?? findTool("mariadb"); if (!cmd) throw new Error("The mysql client was not found on PATH. Install the MySQL/MariaDB client tools.");
  const d = await mysqlDefaults(cfg);
  return { command: cmd, args: [`--defaults-extra-file=${d.file}`, str(cfg.database)], env: {}, stdinFile: file, cleanup: d.cleanup };
}

function pgEnv(cfg: ResolvedConnectionConfig): Record<string, string> {
  return { ...(cfg.password !== undefined ? { PGPASSWORD: str(cfg.password) } : {}), PGSSLMODE: cfg.ssl ? (cfg.sslVerify === false ? "require" : "verify-full") : "prefer" };
}

export interface ToolResult { code: number; stderr: string }

export async function runTool(spec: ToolSpec, o: { signal?: AbortSignal; onOutput?: (line: string) => void } = {}): Promise<ToolResult> {
  try {
    return await new Promise<ToolResult>((resolve, reject) => {
      const child = spawn(spec.command, spec.args, { env: { ...process.env, ...spec.env }, stdio: [spec.stdinFile ? "pipe" : "ignore", spec.stdoutFile ? "pipe" : "ignore", "pipe"], signal: o.signal });
      if (spec.stdinFile) createReadStream(spec.stdinFile).pipe(child.stdin!);
      if (spec.stdoutFile) child.stdout!.pipe(createWriteStream(spec.stdoutFile));
      let stderr = "";
      child.stderr!.on("data", (d: Buffer) => { const t = d.toString(); stderr += t; if (stderr.length > 200_000) stderr = stderr.slice(-100_000); if (o.onOutput) for (const l of t.split("\n")) if (l.trim()) o.onOutput(l.trim()); });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
    });
  } finally { await spec.cleanup(); }
}

/** Confirms a backup file is usable before the user trusts it. */
export async function verifyBackup(engine: BackupEngine | "sqlite", file: string, tools: Partial<Record<string, string>> = {}): Promise<{ ok: boolean; detail: string }> {
  const size = (await stat(file).catch(() => undefined))?.size ?? 0;
  if (size === 0) return { ok: false, detail: "Backup file is missing or empty" };
  if (engine === "postgres") {
    const cmd = tools.pg_restore ?? findTool("pg_restore"); if (!cmd) return { ok: true, detail: `${size} bytes written (pg_restore not found: contents not verified)` };
    const r = await runTool({ command: cmd, args: ["--list", file], env: {}, stdoutFile: undefined, cleanup: async () => {} });
    return r.code === 0 ? { ok: true, detail: `${size} bytes, readable by pg_restore` } : { ok: false, detail: `pg_restore cannot read the file: ${r.stderr.slice(0, 300)}` };
  }
  if (engine === "mysql") {
    const tail = (await readFile(file)).subarray(-300).toString();
    return /Dump completed/.test(tail) ? { ok: true, detail: `${size} bytes, dump completed` } : { ok: false, detail: "The dump does not end with 'Dump completed' (it may be truncated)" };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: true });
  try { const r = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }; return r.integrity_check === "ok" ? { ok: true, detail: `${size} bytes, integrity_check ok` } : { ok: false, detail: r.integrity_check }; } finally { db.close(); }
}

/** SQLite has no external tool to wrap: VACUUM INTO writes a consistent, compacted copy through the driver. */
export async function backupSqlite(conn: { execute(req: { sql: string }, signal: AbortSignal): AsyncIterable<unknown> }, file: string, signal = new AbortController().signal): Promise<void> {
  for await (const _ of conn.execute({ sql: `VACUUM INTO '${file.replaceAll("'", "''")}'` }, signal)) void _;
}

import { appendFile, mkdir, readdir, rename, stat, unlink, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { userInfo } from "node:os";

export interface AuditEntry {
  ts: string;
  user: string;
  connectionId: string;
  connection: string;
  environment: string;
  engine: string;
  /** Statement kind, e.g. SELECT / UPDATE / DROP, or the engine's own verb. */
  kind: string;
  /** Statement text with literals removed unless value logging is enabled. */
  statement: string;
  status: "ok" | "error" | "blocked" | "cancelled";
  rows?: number;
  durationMs?: number;
  detail?: string;
}

/** Replaces string, number and hex literals so the log records what was run without the data it touched. */
export function stripLiterals(text: string): string {
  return text
    .replace(/'(?:[^']|'')*'/g, "'?'")
    .replace(/"(?:[^"\\]|\\.)*"(?=\s*[:,)\]}])/g, '"?"')
    .replace(/\b0x[0-9a-fA-F]+\b/g, "?")
    .replace(/\b\d+(\.\d+)?\b/g, "?")
    .replace(/\s+/g, " ").trim().slice(0, 2000);
}

export interface AuditOptions { file: string; maxBytes?: number; keepFiles?: number; includeValues?: boolean; user?: () => string; now?: () => Date }

/** Local, append-only JSONL audit trail with size-based rotation. Nothing here ever leaves the machine. */
export class AuditLog {
  private chain: Promise<void> = Promise.resolve();
  constructor(private o: AuditOptions) {}

  record(e: Omit<AuditEntry, "ts" | "user" | "statement"> & { statement: string }): Promise<void> {
    const entry: AuditEntry = { ts: (this.o.now?.() ?? new Date()).toISOString(), user: this.o.user?.() ?? userInfo().username, ...e, statement: this.o.includeValues ? e.statement.slice(0, 20000) : stripLiterals(e.statement) };
    if (entry.detail) entry.detail = stripLiterals(entry.detail);
    // serialize writes so rotation cannot interleave with an append
    this.chain = this.chain.then(() => this.write(entry)).catch(() => {});
    return this.chain;
  }

  /** Resolves once every entry recorded so far is on disk. */
  flush(): Promise<void> { return this.chain; }

  private async write(entry: AuditEntry) {
    await mkdir(dirname(this.o.file), { recursive: true });
    const max = this.o.maxBytes ?? 5 * 1024 * 1024;
    const size = (await stat(this.o.file).catch(() => undefined))?.size ?? 0;
    if (size >= max) await this.rotate();
    await appendFile(this.o.file, JSON.stringify(entry) + "\n", { mode: 0o600 });
  }

  private async rotate() {
    const dir = dirname(this.o.file), base = basename(this.o.file, ".jsonl");
    const stamp = (this.o.now?.() ?? new Date()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
    await rename(this.o.file, join(dir, `${base}-${stamp}.jsonl`)).catch(() => {});
    const olds = (await readdir(dir)).filter((f) => f.startsWith(`${base}-`) && f.endsWith(".jsonl")).sort();
    for (const f of olds.slice(0, Math.max(0, olds.length - (this.o.keepFiles ?? 5)))) await unlink(join(dir, f)).catch(() => {});
  }

  async read(opts: { limit?: number; status?: AuditEntry["status"]; connection?: string; search?: string } = {}): Promise<AuditEntry[]> {
    const dir = dirname(this.o.file), base = basename(this.o.file, ".jsonl");
    const files = [...(await readdir(dir).catch(() => [] as string[])).filter((f) => f.startsWith(`${base}-`) && f.endsWith(".jsonl")).sort().map((f) => join(dir, f)), this.o.file];
    const out: AuditEntry[] = [];
    for (const f of files.reverse()) {
      const text = await readFile(f, "utf8").catch(() => "");
      for (const line of text.split("\n").reverse()) {
        if (!line) continue;
        let e: AuditEntry; try { e = JSON.parse(line) as AuditEntry; } catch { continue; }
        if (opts.status && e.status !== opts.status) continue;
        if (opts.connection && e.connection !== opts.connection) continue;
        if (opts.search && !`${e.statement} ${e.connection} ${e.kind}`.toLowerCase().includes(opts.search.toLowerCase())) continue;
        out.push(e);
        if (out.length >= (opts.limit ?? 500)) return out;
      }
    }
    return out;
  }
}

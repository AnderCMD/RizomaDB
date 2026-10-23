import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { redactString } from "@rizomadb/core";

export interface HistoryEntry {
  ts: string;
  connectionId: string;
  connectionName: string;
  environment: string;
  sql: string;
  durationMs: number;
  rowCount: number;
  status: "ok" | "error" | "cancelled" | "blocked";
  error?: string;
}

/** Local JSONL history. SQL and errors are redacted before they touch disk. */
export class History {
  constructor(private file: string, private now: () => Date = () => new Date()) {}

  async add(e: Omit<HistoryEntry, "ts">): Promise<void> {
    const entry: HistoryEntry = {
      ts: this.now().toISOString(), ...e,
      sql: redactString(e.sql),
      ...(e.error !== undefined ? { error: redactString(e.error) } : {}),
    };
    await mkdir(dirname(this.file), { recursive: true });
    await appendFile(this.file, JSON.stringify(entry) + "\n", { mode: 0o600 });
  }

  async list(opts: { limit?: number; search?: string } = {}): Promise<HistoryEntry[]> {
    const text = await readFile(this.file, "utf8").catch(() => "");
    const q = opts.search?.toLowerCase();
    const out: HistoryEntry[] = [];
    for (const line of text.split("\n").reverse()) {
      if (!line) continue;
      try {
        const e = JSON.parse(line) as HistoryEntry;
        if (!q || e.sql.toLowerCase().includes(q) || e.connectionName.toLowerCase().includes(q)) out.push(e);
      } catch { /* skip corrupt line */ }
      if (out.length >= (opts.limit ?? 200)) break;
    }
    return out;
  }

  async prune(retentionDays: number): Promise<void> {
    const text = await readFile(this.file, "utf8").catch(() => undefined);
    if (text === undefined) return;
    const cutoff = this.now().getTime() - retentionDays * 86_400_000, cutoffIso = new Date(cutoff).toISOString();
    const lines = text.split("\n").filter(Boolean);
    // `ts` is the first field of every line we write, so read it with a pattern instead of parsing the whole entry: a big history made startup freeze the extension host.
    const fresh = (l: string) => {
      const iso = /^\{"ts":"(\d{4}-\d\d-\d\dT[^"]*Z)"/.exec(l)?.[1];
      if (iso) return iso >= cutoffIso;
      try { return new Date((JSON.parse(l) as HistoryEntry).ts).getTime() >= cutoff; } catch { return false; }
    };
    const keep: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (fresh(lines[i]!)) keep.push(lines[i]!);
      if (i % 5000 === 4999) await new Promise((r) => setImmediate(r));  // let the host breathe on very large files
    }
    if (keep.length === lines.length && text.endsWith("\n")) return;  // nothing to drop: do not rewrite the file
    await writeFile(this.file, keep.length ? keep.join("\n") + "\n" : "", { mode: 0o600 });
  }
}

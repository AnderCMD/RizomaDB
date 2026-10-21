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
    let text = "";
    try { text = await readFile(this.file, "utf8"); } catch { return []; }
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
    let text = "";
    try { text = await readFile(this.file, "utf8"); } catch { return; }
    const cutoff = this.now().getTime() - retentionDays * 86_400_000;
    const keep = text.split("\n").filter((l) => {
      if (!l) return false;
      try { return new Date((JSON.parse(l) as HistoryEntry).ts).getTime() >= cutoff; } catch { return false; }
    });
    await writeFile(this.file, keep.length ? keep.join("\n") + "\n" : "", { mode: 0o600 });
  }
}

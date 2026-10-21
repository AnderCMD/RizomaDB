import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import type { ColumnInfo, ResultEvent, Value } from "@rizomadb/driver-api";
import { maskFor, type MaskSpec } from "./mask.js";

export type ExportFormat = "csv" | "tsv" | "json" | "jsonl" | "sql" | "markdown";

export interface ExportOptions {
  format: ExportFormat;
  /** Required for `sql`: already-quoted table name and the dialect's identifier quoting. */
  sql?: { table: string; quoteIdent: (n: string) => string };
  mask?: MaskSpec[];
  gzip?: boolean;
  /** AES-256-GCM with scrypt-derived key. File layout: "RZENC1" | salt(16) | iv(12) | ciphertext | tag(16). */
  encryptPassphrase?: string;
  /** CSV/TSV: prefix cells starting with = + - @ so spreadsheets do not evaluate them. */
  neutralizeFormulas?: boolean;
  signal?: AbortSignal;
  onProgress?: (rows: number) => void;
}

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const jsonReplacer = (_: string, v: unknown) => (typeof v === "bigint" ? (v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString()) : v instanceof Uint8Array ? `\\x${hex(v)}` : v);

function text(v: Value): string {
  if (v === null) return "";
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return `\\x${hex(v)}`;
  if (typeof v === "object") return JSON.stringify(v instanceof Array ? v : (v as { json: unknown }).json, jsonReplacer);
  return String(v);
}

const csvCell = (v: Value, sep: string, neutral: boolean) => {
  let s = text(v);
  if (neutral && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replaceAll('"', '""')}"` : s;
};

function sqlLiteral(v: Value): string {
  if (v === null) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Uint8Array) return `X'${hex(v)}'`;
  return `'${text(v).replaceAll("'", "''")}'`;
}

async function* serialize(events: AsyncIterable<ResultEvent>, o: ExportOptions): AsyncGenerator<string> {
  let cols: ColumnInfo[] = [], mask: ReturnType<typeof maskFor>, n = 0, first = true;
  const sep = o.format === "tsv" ? "\t" : ",";
  for await (const ev of events) {
    if (o.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    if (ev.type === "columns") {
      cols = ev.columns; mask = maskFor(o.mask, cols.map((c) => c.name));
      const names = cols.map((c) => c.name);
      if (o.format === "csv" || o.format === "tsv") yield names.map((x) => csvCell(x, sep, false)).join(sep) + "\r\n";
      else if (o.format === "json") yield "[\n";
      else if (o.format === "markdown") yield `| ${names.join(" | ")} |\n| ${names.map(() => "---").join(" | ")} |\n`;
    } else if (ev.type === "rows") {
      let out = "";
      for (const raw of ev.rows) {
        const row = mask ? mask(raw) : raw;
        n++;
        switch (o.format) {
          case "csv": case "tsv": out += row.map((v) => csvCell(v, sep, !!o.neutralizeFormulas)).join(sep) + "\r\n"; break;
          case "jsonl": out += JSON.stringify(Object.fromEntries(cols.map((c, i) => [c.name, row[i]])), jsonReplacer) + "\n"; break;
          case "json": out += (first ? "  " : ",\n  ") + JSON.stringify(Object.fromEntries(cols.map((c, i) => [c.name, row[i]])), jsonReplacer); first = false; break;
          case "markdown": out += `| ${row.map((v) => text(v).replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |\n`; break;
          case "sql": {
            if (!o.sql) throw new Error("SQL export requires a target table");
            out += `INSERT INTO ${o.sql.table} (${cols.map((c) => o.sql!.quoteIdent(c.name)).join(", ")}) VALUES (${row.map(sqlLiteral).join(", ")});\n`;
          }
        }
      }
      o.onProgress?.(n);
      yield out;
    } else if (ev.type === "done" && o.format === "json") yield first ? "]\n" : "\n]\n";
  }
}

/** Streams a result set to `sink` with backpressure; memory stays flat regardless of row count. */
export async function exportResult(events: AsyncIterable<ResultEvent>, sink: Writable, o: ExportOptions): Promise<{ rows: number }> {
  let rows = 0;
  const progress = o.onProgress;
  const opts = { ...o, onProgress: (n: number) => { rows = n; progress?.(n); } };
  const stages: (NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream)[] = [Readable.from(serialize(events, opts), { objectMode: false })];
  if (o.gzip) stages.push(createGzip());
  if (o.encryptPassphrase) {
    const salt = randomBytes(16), iv = randomBytes(12);
    const key = scryptSync(o.encryptPassphrase, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const header = Buffer.concat([Buffer.from("RZENC1"), salt, iv]);
    async function* enc(src: AsyncIterable<Buffer | string>) {
      yield header;
      for await (const c of src) yield cipher.update(typeof c === "string" ? Buffer.from(c) : c);
      yield cipher.final(); yield cipher.getAuthTag();
    }
    stages.push(Readable.from(enc(stages.pop() as unknown as AsyncIterable<Buffer>)));
  }
  stages.push(sink);
  const run = pipeline as unknown as (s: unknown[], opts?: { signal: AbortSignal }) => Promise<void>;
  if (o.signal) await run(stages, { signal: o.signal });
  else await run(stages);
  return { rows };
}

/** Inverse of the encrypted layout; used by tests and by users restoring an export. */
export function decrypt(blob: Buffer, passphrase: string): Buffer {
  if (blob.subarray(0, 6).toString() !== "RZENC1") throw new Error("Not a RizomaDB encrypted export");
  const salt = blob.subarray(6, 22), iv = blob.subarray(22, 34), tag = blob.subarray(blob.length - 16), data = blob.subarray(34, blob.length - 16);
  const d = require_decipher(scryptSync(passphrase, salt, 32), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]);
}
import { createDecipheriv } from "node:crypto";
const require_decipher = (key: Buffer, iv: Buffer) => createDecipheriv("aes-256-gcm", key, iv);

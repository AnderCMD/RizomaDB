import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";

export type SourceFormat = "csv" | "tsv" | "json" | "jsonl";

export function detectFormat(fileName: string, head: string): SourceFormat {
  const n = fileName.toLowerCase();
  if (n.endsWith(".tsv")) return "tsv";
  if (n.endsWith(".jsonl") || n.endsWith(".ndjson")) return "jsonl";
  if (n.endsWith(".json")) return head.trimStart().startsWith("[") ? "json" : "jsonl";
  return "csv";
}

/** BOM first; otherwise valid UTF-8 or (fallback) Windows-1252. */
export function detectEncoding(buf: Uint8Array): { encoding: "utf-8" | "utf-16le" | "utf-16be" | "windows-1252"; bomLength: number } {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { encoding: "utf-8", bomLength: 3 };
  if (buf[0] === 0xff && buf[1] === 0xfe) return { encoding: "utf-16le", bomLength: 2 };
  if (buf[0] === 0xfe && buf[1] === 0xff) return { encoding: "utf-16be", bomLength: 2 };
  try { new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, Math.min(buf.length, 65536)).slice(0, buf.length > 65536 ? 65536 - 3 : undefined)); return { encoding: "utf-8", bomLength: 0 }; }
  catch { return { encoding: "windows-1252", bomLength: 0 }; }
}

/** Picks the delimiter whose per-line count is most consistent over the first lines. */
export function detectDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).filter((l) => l.length).slice(0, 20);
  let best = ",", bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => { let n = 0, q = false; for (const c of l) { if (c === '"') q = !q; else if (c === d && !q) n++; } return n; });
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const score = counts.filter((c) => c === first).length * 1000 + first;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/** Streaming RFC 4180 parser: handles quoted fields, escaped quotes, embedded newlines and both CRLF/LF. */
export async function* parseDelimited(chunks: AsyncIterable<string>, delimiter: string): AsyncGenerator<string[]> {
  let row: string[] = [], field = "", inQuotes = false, justClosedQuote = false, pendingCr = false, any = false;
  for await (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i]!;
      if (pendingCr) { pendingCr = false; if (c === "\n") continue; }
      if (inQuotes) {
        if (c === '"') {
          if (chunk[i + 1] === '"') { field += '"'; i++; }
          else if (i + 1 === chunk.length) { justClosedQuote = true; inQuotes = false; }
          else inQuotes = false;
        } else field += c;
        continue;
      }
      if (justClosedQuote) { justClosedQuote = false; if (c === '"') { field += '"'; inQuotes = true; continue; } }
      if (c === '"' && field === "") { inQuotes = true; any = true; }
      else if (c === delimiter) { row.push(field); field = ""; any = true; }
      else if (c === "\n" || c === "\r") { row.push(field); field = ""; if (c === "\r") pendingCr = true; if (row.length > 1 || row[0] !== "" || any) yield row; row = []; any = false; }
      else { field += c; any = true; }
    }
  }
  if (field !== "" || row.length || any) { row.push(field); yield row; }
}

export async function* decodeStream(stream: Readable, encoding: string, bomLength: number): AsyncGenerator<string> {
  const dec = new TextDecoder(encoding);
  let first = true;
  for await (const chunk of stream) {
    let b = chunk as Buffer;
    if (first) { b = b.subarray(bomLength); first = false; }
    const s = dec.decode(b, { stream: true });
    if (s) yield s;
  }
  const tail = dec.decode();
  if (tail) yield tail;
}

/** Yields one object per element of a top-level JSON array without loading the whole file. */
export async function* parseJsonArray(chunks: AsyncIterable<string>): AsyncGenerator<Record<string, unknown>> {
  let depth = 0, inStr = false, esc = false, started = false, buf = "";
  for await (const chunk of chunks) {
    for (const c of chunk) {
      if (inStr) { buf += c; if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (!started) { if (c === "[") { started = true; } else if (!/\s/.test(c)) throw new Error("Expected a JSON array"); continue; }
      if (c === '"') { inStr = true; buf += c; continue; }
      if (c === "{" || c === "[") { depth++; buf += c; continue; }
      if (c === "}" || c === "]") {
        if (depth === 0 && c === "]") { if (buf.trim()) yield asRow(JSON.parse(buf)); return; }
        depth--; buf += c; continue;
      }
      if (c === "," && depth === 0) { if (buf.trim()) yield asRow(JSON.parse(buf)); buf = ""; continue; }
      buf += c;
    }
  }
  if (started) throw new Error("Unterminated JSON array");
}
const asRow = (v: unknown): Record<string, unknown> => { if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>; throw new Error("JSON array elements must be objects"); };

export async function* parseJsonLines(chunks: AsyncIterable<string>): AsyncGenerator<Record<string, unknown>> {
  let buf = "";
  for await (const chunk of chunks) {
    buf += chunk; let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (line) yield asRow(JSON.parse(line)); }
  }
  if (buf.trim()) yield asRow(JSON.parse(buf));
}

export interface SourceRows { columns: string[]; rows: AsyncGenerator<(string | null | unknown)[]> }

/** Opens a file as column names + rows (strings for delimited files; JSON values for JSON files). */
export async function openSource(path: string, opts: { format?: SourceFormat; delimiter?: string; header?: boolean } = {}): Promise<SourceRows & { format: SourceFormat; delimiter?: string; encoding: string }> {
  const head = await new Promise<Buffer>((res, rej) => { const s = createReadStream(path, { start: 0, end: 65535 }); const c: Buffer[] = []; s.on("data", (d) => c.push(d as Buffer)); s.on("end", () => res(Buffer.concat(c))); s.on("error", rej); });
  const { encoding, bomLength } = detectEncoding(head);
  const text = new TextDecoder(encoding).decode(head.subarray(bomLength));
  const format = opts.format ?? detectFormat(path, text);
  const chunks = () => decodeStream(createReadStream(path), encoding, bomLength);
  if (format === "csv" || format === "tsv") {
    const delimiter = opts.delimiter ?? (format === "tsv" ? "\t" : detectDelimiter(text));
    const it = parseDelimited(chunks(), delimiter);
    const hasHeader = opts.header !== false;
    const first = await it.next();
    const firstRow = first.done ? [] : first.value;
    const columns = hasHeader ? firstRow.map((c, i) => c.trim() || `column_${i + 1}`) : firstRow.map((_, i) => `column_${i + 1}`);
    async function* rows() { if (!hasHeader && !first.done) yield firstRow; for await (const r of it) yield r; }
    return { columns, rows: rows(), format, delimiter, encoding };
  }
  const objs = format === "json" ? parseJsonArray(chunks()) : parseJsonLines(chunks());
  const firstObj = await objs.next();
  const keys = new Set<string>();
  const buffered: Record<string, unknown>[] = [];
  if (!firstObj.done) { buffered.push(firstObj.value); Object.keys(firstObj.value).forEach((k) => keys.add(k)); }
  for (let i = 0; i < 99; i++) { const n = await objs.next(); if (n.done) break; buffered.push(n.value); Object.keys(n.value).forEach((k) => keys.add(k)); }
  const columns = [...keys];
  async function* rows() { for (const o of buffered) yield columns.map((c) => o[c]); for await (const o of objs) yield columns.map((c) => o[c]); }
  return { columns, rows: rows(), format, encoding };
}

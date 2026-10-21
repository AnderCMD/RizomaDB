/** Incremental RFC 4180 reader: feed chunks, get complete records. Quoted fields may contain commas, quotes and newlines. */
export class CsvReader {
  private field = ""; private row: string[] = []; private inQuotes = false; private pendingQuote = false; private sawAny = false; private afterCr = false;
  /** Returns the records completed by this chunk. */
  push(chunk: string): string[][] {
    const out: string[][] = [];
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i]!;
      if (this.afterCr) { this.afterCr = false; if (c === "\n") continue; } // CRLF split across chunks
      if (this.pendingQuote) { // previous char was a quote inside a quoted field
        this.pendingQuote = false;
        if (c === '"') { this.field += '"'; continue; }
        this.inQuotes = false;
      }
      if (this.inQuotes) { if (c === '"') this.pendingQuote = true; else this.field += c; continue; }
      if (c === '"' && this.field === "") { this.inQuotes = true; this.sawAny = true; }
      else if (c === ",") { this.row.push(this.field); this.field = ""; this.sawAny = true; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r") { if (chunk[i + 1] === "\n") i++; else if (i + 1 >= chunk.length) this.afterCr = true; }
        if (this.sawAny || this.field !== "" || this.row.length) { this.row.push(this.field); out.push(this.row); } else out.push([""]);
        this.field = ""; this.row = []; this.sawAny = false;
      } else { this.field += c; this.sawAny = true; }
    }
    return out;
  }
  /** Flushes a final record that lacked a trailing newline. */
  end(): string[][] {
    this.pendingQuote = false;
    if (this.sawAny || this.field !== "" || this.row.length) { this.row.push(this.field); const r = this.row; this.row = []; this.field = ""; this.sawAny = false; return [r]; }
    return [];
  }
}

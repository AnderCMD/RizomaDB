import type { ExecuteRequest, ResultEvent } from "./types.js";

export async function collect(it: AsyncIterable<ResultEvent>) {
  const columns: import("./types.js").ColumnInfo[] = [];
  const rows: import("./types.js").Value[][] = [];
  let done: Extract<ResultEvent, { type: "done" }> | undefined;
  for await (const ev of it) {
    if (ev.type === "columns") columns.push(...ev.columns);
    else if (ev.type === "rows") rows.push(...ev.rows);
    else if (ev.type === "done") done = ev;
  }
  return { columns, rows, done };
}

export type { ExecuteRequest };

/**
 * Lets an operation give up when the connection dies without leaking: racing every call against one
 * long-lived promise would pile up a reaction per call, so each call registers (and removes) its own handler.
 */
export class ConnectionLoss {
  private handlers = new Set<(e: Error) => void>();
  private error: Error | undefined;
  fire(e: Error) { this.error = e; for (const h of [...this.handlers]) h(e); }
  get lost(): Error | undefined { return this.error; }
  race<T>(p: Promise<T>): Promise<T> {
    if (this.error) return Promise.reject(this.error);
    return new Promise<T>((resolve, reject) => {
      const h = (e: Error) => reject(e);
      this.handlers.add(h);
      p.then((v) => { this.handlers.delete(h); resolve(v); }, (e: unknown) => { this.handlers.delete(h); reject(e as Error); });
    });
  }
}

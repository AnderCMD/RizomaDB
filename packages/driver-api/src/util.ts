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

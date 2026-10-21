/** On-disk format of a RizomaDB SQL notebook (.sqlnb): plain JSON, no outputs, so it diffs and re-runs cleanly in Git. */
export interface NotebookCellData { kind: "sql" | "markdown"; source: string }
export interface NotebookFile { version: 1; connection?: string; cells: NotebookCellData[] }

export function parseNotebook(text: string): NotebookFile {
  if (!text.trim()) return { version: 1, cells: [] };
  const j = JSON.parse(text) as Partial<NotebookFile>;
  if (j.version !== 1 || !Array.isArray(j.cells)) throw new Error("Not a RizomaDB notebook (expected version 1)");
  const cells = j.cells.filter((c): c is NotebookCellData => !!c && (c.kind === "sql" || c.kind === "markdown") && typeof c.source === "string");
  return { version: 1, ...(typeof j.connection === "string" ? { connection: j.connection } : {}), cells };
}

export function serializeNotebook(n: NotebookFile): string {
  return JSON.stringify({ version: 1, ...(n.connection ? { connection: n.connection } : {}), cells: n.cells }, null, 2) + "\n";
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Result table as escaped HTML (cell values are data, never markup). */
export function tableHtml(columns: string[], rows: (string | null)[][], note?: string): string {
  const head = `<tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((v) => (v === null ? `<td><i>NULL</i></td>` : `<td>${esc(v)}</td>`)).join("")}</tr>`).join("");
  return `<table border="1" cellpadding="4" style="border-collapse:collapse"><caption>${esc(note ?? `${rows.length} rows`)}</caption><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

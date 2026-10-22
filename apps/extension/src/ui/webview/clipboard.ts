/**
 * Splits clipboard text into rows and cells the way spreadsheets write it: tab-separated, rows ending in a line break,
 * and cells that contain tabs, line breaks or quotes wrapped in double quotes (a quote inside is doubled).
 */
export function parsePasted(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, i = 0;
  const endCell = () => { row.push(cell); cell = ""; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } quoted = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === "") { quoted = true; i++; continue; }
    if (ch === "\t") { endCell(); i++; continue; }
    if (ch === "\r" && text[i + 1] === "\n") { endRow(); i += 2; continue; }
    if (ch === "\n" || ch === "\r") { endRow(); i++; continue; }
    cell += ch; i++;
  }
  if (cell !== "" || row.length > 0 || quoted) endRow();
  return rows;
}

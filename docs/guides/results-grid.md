# The results grid

Opening a table or running a query shows the rows in a grid built for exploring. Every button is an icon with a label when you hover or focus it.

## Anatomy
1. **Header**: the connection (logo, name, environment), the table, and a status such as `1 000 rows · 12 ms · more rows available`.
2. **Tabs** (only for tables): **Data**, **Properties**, **Relations**, **DDL**.
3. **Query line**: the statement that produced the rows. **It is editable.**
4. **Filter bar** (tables of the supported engines): filter and order in the database.
5. **Toolbar**: find, filters per column, show/hide columns, record panel, compact rows, copy, save, run again, shortcuts.
6. **Edit bar** (editable results): edit, add row, delete, undo, redo, review SQL, discard, **Apply**.
7. **Grid**, then a **footer** with the row count, time and statistics of the selected column.

## The query line
Change the text and press the play button or **Ctrl/⌘+Enter** to run it; **Esc** puts the original back. Edited text is a **new query**: it no longer says which table it shows, so its result is read-only. If you have pending edits you are asked before they are discarded. Unchanged text just re-runs the table view. The other two buttons copy the query or open it in a normal editor.

## Filtering in the database
For tables, a bar under the query line changes the statement itself, so paging and editing keep working:

| Engine | Filter box | Order box |
|---|---|---|
| SQL engines | a condition: `age > 30 AND city = 'Lima'` | `name DESC` |
| MongoDB | a Mongo query: `{ "status": "A" }` | a sort: `{ "total": -1 }` |
| Elasticsearch / OpenSearch | search text: `level:error` | `timestamp:desc` |
| Neo4j | a condition on `n`: `n.age > 30` | `n.name` |

Press Enter (or the check button) to apply and **Esc** (or the cross) to clear. The text is placed in a statement by one checked function: `;`, comments and unpaired brackets are refused, and the statement still goes through the policy. This is different from the **funnel in the toolbar**, which filters only the rows already loaded.

## Working with columns
Click a column name to **sort** (ascending, descending, none). Drag the edge to **resize** (double-click fits the content). The **⋮** menu of a header, or a right-click on it, offers: sort, clear sorting, filter this column, fit width, hide, **column statistics…**, copy name, copy values. *Column statistics* opens a small panel with the number of values, nulls and distinct values, the minimum and maximum (plus average and sum for numbers) and a bar chart: the most frequent values, or a histogram for a numeric column with many distinct values. It is computed over the rows shown in the grid (filters apply), not over the whole table. Hidden columns come back from the columns button. Widths and hidden columns are remembered per result shape.

For SQL tables the same menu can change the structure: **Rename column…**, **Change type…**, **Toggle NOT NULL**, **Set default…**, **Add column…**, **Drop column…**. Each shows the exact SQL and asks for confirmation; destructive changes are flagged and policies apply. SQLite cannot alter some things in place and tells you so.

## Cells, rows and the record panel
- Right-click a cell: copy, copy row as JSON, filter by this value, open the record panel, edit, set NULL, set to empty text, delete row.
- Click the number at the left of a row to select it; Ctrl/⌘ toggles and Shift selects a range. **Select all** is the check in the corner.
- **Record panel** (Alt+Enter): one row as a form, with previous/next, copy as JSON, per-field copy and NULL buttons and JSON formatting.
- Booleans show ✓/✗, numbers are right-aligned, NULL and DEFAULT are marked, and key (🔑) and NOT NULL (*) are marked in the header.

## Copy and save
The copy and save buttons export **what you see** (visible columns, current order and filter) or only the selected rows, as **CSV, TSV, JSON or Markdown**. For very large results use **Export Data…**, which streams to a file.

## Paging
A table opens with a first page (`rizomadb.table.openRows`, 200); a query starts with `rizomadb.query.pageSize` (1000). If more rows exist, the footer shows **Load N more** and **Load all**; the new rows are appended without losing your sort, filters or selection. `rizomadb.query.maxRows` (100 000) is the most rows kept in one view; past it the footer tells you to refine the query or export.

How it works, honestly: the query is run again and the rows already shown are skipped, which works on **every** engine. The database does the work again up to that point, so very deep pages are slower, and without an `ORDER BY` the engine is not obliged to return rows in the same order twice. For a stable result on a changing table, sort it. If you have pending edits you must apply or discard them before loading more.

Optional, off by default: turn on `rizomadb.query.keysetPaging` and a table is opened sorted by its primary key, and *Load more* asks the database for the rows **after** the last key instead of skipping rows, so deep pages stay as fast as the first. It is tested on SQLite, PostgreSQL and MySQL; other engines, tables without a primary key, keys that are not numbers or text, and a custom sort typed in the filter box keep skipping rows. Because the table is then ordered by its key, the row order differs from the engine's natural order.

## Where results open
`rizomadb.results.location`: `bottom` (the lower half under the editor, the default), `full` (the whole editor area) or `beside`.

## Shortcuts
| Keys | Action |
|---|---|
| Arrows, Home/End, PageUp/PageDown | Move between cells |
| Shift + ↑/↓ | Extend the row selection |
| Space | Select or unselect the row |
| Ctrl/⌘ + A | Select all rows |
| Enter, F2, double-click | Edit the cell |
| Delete | Set NULL, or delete the selected rows |
| Ctrl/⌘ + Z / Y | Undo / redo |
| Ctrl/⌘ + C | Copy the cell or the selected rows |
| Ctrl/⌘ + F | Find in results |
| Alt + Enter | Record panel |
| Shift + F10 | Context menu |
| Esc | Clear the selection |

The keyboard button in the toolbar lists them in the application.

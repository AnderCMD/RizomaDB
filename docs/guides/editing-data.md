# Editing data

## What can be edited
A result is editable when it comes from **opening a table** that RizomaDB can identify rows of:

| Engine | Rows are identified by |
|---|---|
| SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, DuckDB | the primary key |
| MongoDB | the document `_id` |

Views, custom queries, edited query lines, masked columns, read-only connections and tables without a primary key are **not** editable; when you try, the grid tells you why. Every other engine, including Redis and Valkey keys, is read-only in the grid (Redis has its own commands for deleting, renaming and expiring keys).

## How
1. **Double-click** a cell (or select it and press **Enter** or **F2**, or use the pencil button). A box opens with the value.
2. Type and press **Enter** to keep, **Esc** to cancel. **Delete** sets NULL; the right-click menu has *Set to NULL* and *Set to empty text*.
3. **Add row** appends a row; unset cells show `DEFAULT`. The trash button marks the selected rows for deletion (and restores them). Undo (Ctrl/⌘+Z) discards added rows.
   **Paste from a spreadsheet:** select a cell and press Ctrl/⌘+V. Tab-separated cells (what Excel, Numbers and Sheets copy) fill down and to the right from the selected cell, empty cells become NULL, and a single value fills every selected row of that column. Up to 5,000 cells per paste; it is one undo step, and if any cell is not valid for its column nothing is applied.
4. The footer of the edit bar counts the **pending changes**. Edited cells are highlighted, deleted rows are struck through.

Values are checked against the column type as you type: an integer column refuses `abc`, JSON columns must be valid JSON, and binary columns cannot be edited here.

## Review and apply
- **Review SQL** opens the exact statements that would run (with their parameters), without running them.
- **Apply** sends all changes **in one transaction** on engines that have transactions. On engines without transactions (for example MongoDB) changes are applied one by one, and the message says how many were already applied if one fails.
- Production and staging ask for confirmation before applying; `requireApproval` asks you to type the connection name. Policies, read-only connections and the audit log apply exactly as for the editor.
- **Conflict detection.** Each change checks that the row still has the values you saw; if someone else changed or deleted it, nothing is applied and you are told.
- **Discard** drops everything pending.

## Save each edit immediately
Turn on `rizomadb.edit.applyImmediately` if you do not want a separate Apply step. Each edit is applied as soon as you confirm it. Only `dev` connections skip the prompt; every other environment still asks, and policies and read-only rules always apply. Off by default.

## Changing structure
Renaming, retyping or dropping a column is in the column menu (see [The results grid](results-grid.md#working-with-columns)). New tables and bigger changes use **Design Table**, with a DDL preview before anything runs.

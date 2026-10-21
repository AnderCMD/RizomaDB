# The query editor

**RizomaDB: New Query** opens an editor in the language of the connection: SQL, Mongo shell, Redis commands, Cypher (Neo4j, HydraDB), REST requests for Elasticsearch/OpenSearch and the JSON console of Firestore, or Flux and CQL where those engines apply. Pick the connection with the status bar item or the first lens in the editor.

## Running
| Action | How |
|---|---|
| Run the statement under the cursor | **Ctrl+Enter** (⌘+Enter), or the **Run** lens above it |
| Run the selection | **Ctrl+Shift+Enter** (⌘+Shift+Enter) |
| Run every statement | **Run all (N)** lens at the top of the file, or **RizomaDB: Run All Statements** |
| Explain the plan (SQL engines that support it) | **Explain** lens, or **RizomaDB: Explain Query Plan** |
| Cancel | **RizomaDB: Cancel Running Query**, or the stop button in the results header |

**Run all** runs the statements in order and stops at the first error. Outside `dev` it asks for confirmation first, once for the whole file. Each statement still goes through the policy and the audit log on its own.

### Statements
- SQL is split on top-level semicolons (strings, comments and PostgreSQL dollar quotes are understood). Cypher splits on `;` too.
- Mongo shell and the search-engine console use **blank-line separated blocks**; Redis uses **one command per line**. Comment lines (`//`, `#`, `--`) are ignored.
- The statement under the cursor is **highlighted** (`rizomadb.editor.highlightStatement`). The lenses can be turned off with `rizomadb.editor.codeLens`.

### Parameters
Placeholders such as `:name`, `$1`, `@name` or `?` ask for their values before running. Values are typed (`null`, `true`, numbers and `"quoted text"`; anything else is text), bound by the driver and remembered per connection.

## Results
Results open in the lower half of the window (`rizomadb.results.location`). Every run replaces the same tab; **Pin Results Tab** keeps it. The tab is named `connection.table` with the engine's logo. See [The results grid](results-grid.md).

## History
**RizomaDB: Open Query History** opens a screen with everything you ran, newest first, grouped by day. Search the text, filter by status (all, succeeded, failed) or connection, and for each entry **open in an editor**, **run again** (when the connection still exists) or **copy**. **Clear** deletes the history. Statements and errors are stored locally with secrets redacted; `rizomadb.history.enabled` and `rizomadb.history.retentionDays` control it.

## Notebooks
**New SQL Notebook** creates a `.sqlnb` notebook: SQL cells with their results below, saved as plain JSON.

## Safety
Every statement is classified before it runs. Reads run; writes follow the environment (confirmation, approval, read-only); destructive statements (`DROP`, `TRUNCATE`, `UPDATE`/`DELETE` without `WHERE`…) ask first. The reason is shown in your language. See [Policies](../enterprise/policy.md).

<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Troubleshooting

**I cannot edit a cell.** Only tables with a primary key (or MongoDB documents, Redis keys) opened from the tree are editable. Views, custom queries, a query line you edited and read-only connections are not; the grid explains which applies. Make sure the connection is not read-only and the environment is not `prod` with read-only protection.

**The connection fails on localhost with a TLS error.** For `localhost` the form unchecks TLS by default. If you saved a connection earlier with TLS on, edit it or create it again. Real servers usually need TLS on; see the engine's page.

**"Load more" never appears.** There are no more rows, or the row limit (`rizomadb.query.maxRows`) was reached; the footer says which. Statements that are not reads return no rows to page.

**Pages repeat or skip rows.** Paging re-runs the query and skips the rows already shown, so without an `ORDER BY` the engine may return rows in a different order. Sort the result in the query or the order box.

**A filter is refused.** The text cannot contain `;`, comments or unpaired brackets. Write one condition only.

**The tree shows no tables for HydraDB.** HydraDB cannot list labels. Write the labels you want in the connection's *Labels to show in the tree* field.

**HydraDB answers "internal query execution error".** Almost always a wrong **Cell ID**; HydraDB cannot list cells, so ask the operator.

**Everything is read-only after I edited a policy file.** A policy file that cannot be read makes all writes fail closed. Open the *RizomaDB policy* output channel for the error.

**A screen is in the wrong language.** Set `rizomadb.language`; reopen open screens. Command and setting names follow VS Code's language.

**Oracle says "NJS-138" or that the server is too old.** RizomaDB connects without the Oracle Client, which needs Oracle Database 12.1 or later. Older servers are not supported.

**A screen says "Could not register service worker" or stays blank.** This is a VS Code problem, not an extension one: close every VS Code window and open it again. If it repeats, quit VS Code and delete its `Service Worker` cache folder (on macOS, `~/Library/Application Support/Code/Service Worker`).

**The window slows down or freezes with a huge database.** A node lists at most 2,000 tables (use **Open Table Data** from the command palette to reach any table), and SQL completion reads only table names in schemas of more than 1,500 tables. A server that does not answer is abandoned after 45 seconds. If it still happens, tell us the engine, how many tables it has and what you did just before.

**A big `.sql` file (a data dump) has no error underlining or completion.** Files larger than 1 MB are not analysed, because doing it on every keystroke would stall VS Code. The Run buttons and running statements still work.

**My connection form went back to "New connection" when I changed tab.** Fixed in 1.2.2: the screen now keeps what you typed. Update the extension.

Still stuck? The *RizomaDB policy* output channel and the status bar show what is blocking an action. Please open an issue with the engine, version and the steps.

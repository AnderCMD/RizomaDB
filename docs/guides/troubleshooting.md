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

Still stuck? The *RizomaDB policy* output channel and the status bar show what is blocking an action. Please open an issue with the engine, version and the steps.

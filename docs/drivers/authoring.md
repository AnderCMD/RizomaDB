<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Writing a driver

A driver is an object implementing `DriverPlugin` from `@rizomadb/driver-api`:

```ts
export const myDriver: DriverPlugin = {
  id: "mydb", displayName: "MyDB", family: "relational", capabilities, quoteIdent, placeholder: (i) => `$${i}`,
  selectTop: (table, n) => `SELECT * FROM ${table} LIMIT ${n}`, connectionSchema,
  async connect(cfg, ctx) { /* return a Connection */ },
};
```
Keep metadata (`meta.ts`: capabilities, schema, quoting) in a file that does not import the client library, so the extension host can show the connection form without loading it.

A `Connection` provides `execute(req, signal)` (an async iterator of `columns`, `rows` batches and one `done` event, honouring `maxRows`, `batchSize` and the `AbortSignal`), `introspect()`, `ping()`, `close()` and optionally `begin()`.

Rules:
1. Errors are `DriverError` with a precise `kind` (`syntax`, `authentication`, `permission`, `constraint`, `timeout`, `cancelled`, `connection`). Syntax errors carry a 1-based `position` when the engine reports it.
2. 64-bit integers beyond 2^53 are `bigint`; decimals are strings; JSON is `{ json }`; never lose precision silently, document it if the client library forces it.
3. If the server can terminate a connection mid-query, make sure pending reads reject (see the PostgreSQL and MySQL drivers for how hangs were fixed).
4. Declare `readOnlyEnforcement` honestly (`server` only if the engine rejects writes by itself).
5. Non-SQL engines set `language`, `assess()` (risk of a command) and, for editing, `generateChange()`.

Run the shared kit in your tests: `runConformance({ plugin, config, slowSql, paramSql, ... })` from `@rizomadb/driver-api/conformance`. Every bundled driver passes it against a real server. Third-party drivers are published as npm packages exporting a `DriverPlugin`; loading them in the extension is **not implemented yet** (drivers are bundled at build time).

# Connections

## The New connection screen
**RizomaDB: New Connection** opens a screen with every engine as a card with its logo, grouped by type. Pick one and fill in the form.

- **Defaults per engine.** Host, port and the usual user are already there (for example PostgreSQL `postgres@localhost:5432/postgres`, MySQL and MariaDB `root`, SQL Server `sa`, Oracle `system` with service `FREEPDB1`, MongoDB and Redis with no user). Fields an engine does not need stay empty and optional.
- **TLS on your own machine.** For `localhost`, `127.0.0.1` and `::1` the TLS box starts unchecked, because local servers rarely speak TLS, and no warning is shown. Change the host to a remote one and it goes back to the engine's default; unchecking TLS for a remote host asks you to confirm.
- **Test connection** connects and pings without keeping anything. **Save connection** stores the profile and connects; if that fails you can fix the fields and retry, or choose **Save without connecting**.
- Passwords, tokens and keys go to VS Code's **secret storage**. A shared catalog never contains them: each person types their own.

### Environments and protection
Every connection has an environment. `prod` is read-only by default and `staging` asks before every write. Choose **New environment…** in the form to create your own: give it a name (lowercase letters, digits and dashes) and a protection:

| Protection | Effect |
|---|---|
| Ask before every write | A confirmation for every statement that changes data |
| Block writes | The environment is read-only |
| No protection | Nothing extra |

New environments are saved in the `rizomadb.environments` setting, where you can also edit them. They can only make things stricter than your policy files, never looser. See [Policies](../enterprise/policy.md).

### Network path
By default RizomaDB connects directly. Under **Network path** you can go through an **SSH tunnel** (key file or password, with strict host-key checking and a prompt for unknown hosts) or an **HTTP proxy** / **SOCKS5 proxy** (with optional user and password). A connection uses an SSH tunnel *or* a proxy, not both.

## Saved connections
The second tab of the same screen lists the connections you have. Each card shows the engine's logo, the environment, whether it is read-only or shared, the target (`host:port`) and its **database**, and whether it is connected. A **● Active** badge marks the one in use. The buttons connect or disconnect, open a new query, toggle read-only and delete.

## The connections tree
- Connections are grouped by engine type (turn this off with `rizomadb.explorer.groupByFamily`).
- Each row carries the engine's logo, `[ENVIRONMENT]`, the database and a dot for the active one.
- Under a connection: **Tables** (or Collections, Keys, Indices, Labels, Measurements, depending on the engine) with a count, and **Views**.
- Hover a row for quick buttons. The view title has buttons for new connection, refresh, import, settings, the guide and **collapse all**.

## The connection in use
The *active* connection is the one bound to the query editor you are in, or the last one that ran something. The status bar shows it as `[ENV] name · database`; click it to change the connection of the current editor.

## A read-only account for the server-side guarantee
Marking a connection read-only is enforced by RizomaDB (and by the server where the engine allows it). For a guarantee that does not depend on any client, give the connection a database account that can only read. Right-click the connection and choose **Generate Read-Only User Script…**: you pick the account name and RizomaDB opens a script in an editor. It never runs it and never writes a password: replace the `<choose-a-password>` placeholder and run it with an administrator account. Available for PostgreSQL, MySQL/MariaDB, ClickHouse and Redis/Valkey; each script was run against a real server and the new account was checked to read and to be refused writes (other engines say so instead of guessing).

## Import from other tools
**RizomaDB: Import Connections From Other Tools…** reads connection strings, `~/.pgpass`, `~/.my.cnf`, DBeaver and SQLTools files. See [Migrating](migration.md).

## Share connections with a team
A catalog file (`.rizomadb/connections.json` in the project, or the file named in `rizomadb.catalog.teamFile`) lists connections without secrets; each person adds their own password the first time. Shared entries are read-only in the interface.

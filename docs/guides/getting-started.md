<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Getting started

This page takes you from nothing to editing a value in a table. The same walk-through is built into the extension: run **RizomaDB: Open the Guide** (the book icon in the connections view) and it takes you step by step, with buttons that do each step for you.

## 1. Install
Install RizomaDB from the VS Code Marketplace (search for "RizomaDB", or run `code --install-extension AnderCMD.rizomadb`), or download the `.vsix` file from the latest [GitHub release](https://github.com/AnderCMD/RizomaDB/releases) and install it:

```bash
code --install-extension rizomadb-1.2.0.vsix
```

To build it yourself:

```bash
pnpm install
pnpm --filter rizomadb package          # creates apps/extension/rizomadb-<version>.vsix
```

It also installs in VSCodium, Cursor and Windsurf (use their own `--install-extension`). Reload the window afterwards.

## 2. Create a connection
1. Click the RizomaDB icon in the activity bar, then the **+** button (or run **RizomaDB: New Connection**).
2. Pick your engine by its logo. Use the search box if the list is long.
3. The form is already filled with the usual values for that engine (host `localhost`, the default port, the typical user). Change only what differs, and add the password.
4. Choose the **environment**: `dev`, `staging`, `prod`, or **New environment…** for your own (for example `qa`). Production asks before writing; see [Connections](connections.md).
5. **Test connection** checks it without saving. **Save connection** stores it. If it cannot connect, you can still choose **Save without connecting**.

## 3. Explore
The connections tree groups your connections by type (relational, documents, key-value…) and shows each engine's logo. Expand one to see its tables (or collections, keys, indices…) and views. The status bar at the bottom shows the connection in use and its database.

## 4. Open a table
Click a table. The rows open in the lower half of the window. The tabs above the grid show **Data**, **Properties** (columns, types, indexes), **Relations** (foreign keys both ways) and **DDL** (the CREATE script). See [The results grid](results-grid.md).

## 5. Run a query
Run **RizomaDB: New Query**, write a statement and press **Ctrl+Enter** (⌘+Enter on Mac). Every statement also gets a **Run** button above it. See [The query editor](query-editor.md).

## 6. Edit a value
In a table that has a primary key, double-click a cell (or press Enter or F2), type, press Enter. The change waits as a *pending change*: review the SQL, then press **Apply**. Production and staging ask for confirmation first. See [Editing data](editing-data.md).

## 7. Make it yours
Run **RizomaDB: Open Settings** for the settings screen: language, where results open, rows per page, environments and more. See [Language and settings](language-and-settings.md).

## Good to know
- Nothing is sent anywhere. There is no telemetry and no account. Passwords and tokens live in VS Code's secret storage, never in a settings file.
- If something does not work as you expect, see [Troubleshooting](troubleshooting.md).

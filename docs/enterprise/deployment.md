<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Deployment

## Air-gapped / offline
* The extension makes **no network connections of its own**: no telemetry, no update checks, no remote configuration. A test (`apps/extension/src/activation.test.ts`) fails if activation opens a socket or if extension/core sources import network modules.
* Install from a VSIX (`code --install-extension rizomadb-x.y.z.vsix`) or from an internal Open VSX mirror. Verify `SHA256SUMS` and the build provenance attestation attached to each release.
* Pin the version in your management tooling; updates are explicit.

## Mass installation
* **Intune / GPO / Ansible:** distribute the VSIX and run `code --install-extension` per user, or use your internal marketplace. Deliver `rizomadb.policy.team` and `rizomadb.catalog.teamFile` through managed VS Code settings (machine scope).
* **Dev Containers / Codespaces:** add the extension id to `devcontainer.json`; connections are made from the remote side, so the database must be reachable from the container.

## Proxies and internal certificates
* Database connections can go through an SSH tunnel (bastion host), an **HTTP CONNECT proxy** or a **SOCKS5 proxy**, chosen per connection under *Network path* (a connection uses a tunnel *or* a proxy). The proxy code is tested against local fake proxy servers and, in CI, against a real **Squid 6** (HTTP CONNECT, with and without basic authentication) and a real SOCKS5 server (`go-socks5-proxy`, username/password) reaching a real PostgreSQL. It has **not** been tested against Dante or other proxy products, or against proxies that require NTLM/Kerberos.
* The extension's own AI calls (off by default) and nothing else are the only traffic that does not go to a database you configured.
* Internal CAs: PostgreSQL and MySQL accept a CA file per connection (`sslCaFile`); for everything else set `NODE_EXTRA_CA_CERTS` for VS Code. TLS verification is on by default and disabling it shows a modal warning.

## Shared connection catalogs
`.rizomadb/connections.json` (project) and the file named by `rizomadb.catalog.teamFile` (team) list connections **without secrets**; each user is asked for `secretKeys` once and the answer stays in their own VS Code SecretStorage. Entries containing plain-text secrets are rejected. Later layers override earlier ones by `id`. Catalog entries cannot be edited or deleted from the UI.
```json
{ "version": 1, "connections": [ { "id": "orders-stg", "name": "Orders (staging)", "driver": "postgres", "environment": "staging", "options": { "host": "orders.stg.internal", "port": 5432, "database": "orders", "user": "app", "ssl": true }, "secretKeys": ["password"] } ] }
```
`${env:VAR}` and `${workspaceFolder}` are expanded in option values.

## Workspace Trust
In an untrusted workspace the project policy, the project catalog and `.rizomadb` files are not loaded; user and team layers still apply.

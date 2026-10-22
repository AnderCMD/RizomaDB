# AGENTS.md

Instructions for AI coding agents (and humans in a hurry) working on RizomaDB. Read this before changing code. Human-oriented docs are in [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## What this is
A free (Apache-2.0), no-telemetry, multi-engine database client for VS Code. pnpm workspaces + Turborepo, TypeScript strict, esbuild bundles, vitest. Code, comments and commit messages are in English; the user-facing text and the documentation exist in English and Spanish (this file stays in English only).

## Map first: use the graph
`graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` are a knowledge graph of the **code** (AST only; docs are not in it). Before searching files, read the report's god nodes and communities, or ask: `graphify query "<question>"`, `graphify path "A" "B"`, `graphify explain "Node"`. A post-commit hook rebuilds it locally (`graphify hook install`); after large changes run `graphify update .` and commit the refreshed `graph.json` and report. Treat the graph as a map, not as proof: confirm in the source.

## Layout
| Path | What |
|---|---|
| `apps/extension` | The VS Code extension: host code in `src/`, webview scripts in `src/ui/webview/`, `l10n/`, `package.json` manifest, `e2e/` |
| `packages/driver-api` | Driver contract, typed errors, conformance kit |
| `packages/drivers/*` | One package per engine family (`meta.ts` = metadata only, `index.ts` = client code) |
| `packages/core` | Profiles, secrets, policy, guard, audit, editing |
| `packages/{schema-tools,data-tools,sql,admin,network,ai,mcp}` | Feature libraries |
| `docs/` | Guides (`guides/`, `es/guias/`), references (generated), engines, enterprise, security |
| `site/` | VitePress site (copies `docs/` via `sync-docs.mjs`) |
| `test/compose` | Docker services for the engine tests; `test/a11y` axe harness pages |

## Commands
```bash
pnpm install
pnpm lint && pnpm build && pnpm typecheck && pnpm test      # must pass
pnpm --filter rizomadb test:e2e                              # real VS Code
pnpm --filter rizomadb package                               # builds drivers first, then the VSIX
node scripts/gen-reference.mjs                               # after changing settings, commands or driver capabilities (CI runs --check)
node scripts/gen-logos.mjs <dir-with-icon-packages>          # regenerates engineLogos.ts
```
Engine suites skip when their engine is down locally and **fail in CI** (`RZ_REQUIRE_ENGINES`). Five engines (CockroachDB, YugabyteDB, InfluxDB 3, Firestore, HydraDB) and the real Squid/SOCKS5 proxy test run in the `engines-extra` CI job; the rest are job services of the `test` job. Start one with `docker compose -f test/compose/docker-compose.yml up -d <engine>`.

## Rules that are not negotiable
1. **No telemetry, no network calls of the extension's own.** A test asserts zero sockets on activation.
2. **Secrets only in VS Code SecretStorage.** Never in settings, state, logs, history or the audit log.
3. **Every statement goes through the guarded connection** (`packages/core/src/guard.ts`): one policy check and one audit entry. Never call a driver's `execute` from UI code on an unguarded connection.
4. **Do not claim support you have not tested.** A capability or engine is documented as supported only with a test against a real engine; otherwise say "not tested". Keep `docs/release/v1-checklist.md` and its Spanish counterpart honest.
5. **Never publish.** No Marketplace, Open VSX, release workflow or tags without the owner's explicit confirmation. Deploying the docs site happens only from `main` through `pages.yml`.
6. **No placeholder code** (`TODO`, stubs) in finished work. No copying code or logos from closed-source products. Engine logos come only from `scripts/gen-logos.mjs` (CC0/MIT sources).
7. **Webviews are hardened**: strict CSP with a nonce, `localResourceRoots` limited to `dist`, every message validated with zod on both sides, no `innerHTML`/`eval` (a test enforces this). Build DOM with `el()`/`icon()`.
8. **User text is translated.** Host: `t()` from `src/i18n.ts`. Webview: `tr()` plus an entry in `webviewStrings.ts`. Add the Spanish string to `l10n/bundle.l10n.es.json` and, for manifest text, to `package.nls.es.json`; a test fails otherwise. Messages written by drivers/policy/editing are mapped in `src/ui/driverMessages.ts`.
9. **Documentation exists in English and Spanish.** When you change a page in `docs/`, a root file (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG, GOVERNANCE, ROADMAP) or the brand README, update its Spanish counterpart (`docs/es/`, `*.es.md`); `node scripts/check-docs-parity.mjs` lists what is missing and CI runs it. `AGENTS.md` is the only file kept in English alone.
10. **Accessibility is a requirement**: WCAG 2.2 AA, keyboard reachable, icon-only controls have an accessible name and a tooltip, axe must report zero violations in light and dark (`test/a11y`).

## Conventions
- Match the surrounding code: terse, strict types, comments only for the *why*.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`). Work on a branch → PR into `dev`; `dev` → `main` by PR (see `docs/ci-cd.md`).
- New driver: pass `runConformance`, add `docs/engines/<id>.md`, register it in `extension.ts`, `worker/driverWorker.ts`, `engineCatalog.ts`, `scripts/gen-reference.mjs`, and `docker-compose.yml` if it has an image. Read-only mode must be enforced by the server where possible, otherwise by a default-deny classifier — and say which in the docs.
- New setting or command: declare it in `package.json` and both `package.nls*.json`, give it a title in `settingsPanel.ts` if it is a setting, then regenerate the references.
- Packaging uses the **built** driver packages: after changing a driver run `pnpm --filter rizomadb package` (it builds dependencies), not just esbuild.
- Design: follow [docs/design/design-guide.md](docs/design/design-guide.md).

## Verify before you say "done"
Run lint, typecheck and tests; for UI changes also render the harness page (`node test/a11y/prepare.mjs`, then open `http://localhost:8766/<page>.html`) and run axe in both themes. Report what you did **not** verify (a real VS Code window, a real server) instead of implying it.

# Contribuir / Contributing

1. `pnpm install`. Start the engines you need for tests: `docker compose -f test/compose/docker-compose.yml up -d <engine>` (levanta los motores que necesites).
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` must pass. Engine suites skip when their engine is down locally and fail in CI. For the extension also run `pnpm --filter rizomadb test:e2e` (a real VS Code).
3. Branches: work on a branch, open a pull request into **`dev`**; `dev` is promoted to **`main`** with a pull request (the *Promote dev to main* workflow opens it). See [docs/ci-cd.md](docs/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). No telemetry, no secrets outside SecretStorage, no `TODO` in finished code.
5. Every new driver must pass `runConformance` from `@rizomadb/driver-api/conformance`, add an engine page to `docs/engines/` and appear in `scripts/gen-reference.mjs`.
6. User-visible text goes through `t()` (host) or the webview strings table, with a Spanish translation in `apps/extension/l10n/bundle.l10n.es.json`; a test fails when one is missing.
7. After changing settings or commands run `node scripts/gen-reference.mjs` to refresh the reference pages (CI checks they are current).
8. Important technical decisions: add an ADR in `docs/adr/`.

Contribution license: Apache-2.0.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-dark.svg">
    <img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-horizontal-light.svg" alt="RizomaDB" width="320">
  </picture>
</p>

# Contributing

English · [Español](CONTRIBUTING.es.md)

1. `pnpm install`. Start the engines you need for tests: `docker compose -f test/compose/docker-compose.yml up -d <engine>`.
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` must pass. Engine suites skip when their engine is down locally and fail in CI. For the extension also run `pnpm --filter rizomadb test:e2e` (a real VS Code).
3. Branches: work on a branch, open a pull request into **`dev`**; `dev` is promoted to **`main`** with a pull request (the *Promote dev to main* workflow opens it). See [docs/ci-cd.md](docs/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). No telemetry, no secrets outside SecretStorage, no `TODO` in finished code.
5. Every new driver must pass `runConformance` from `@rizomadb/driver-api/conformance`, add an engine page to `docs/engines/` and appear in `scripts/gen-reference.mjs`.
6. User-visible text goes through `t()` (host) or the webview strings table, with the Spanish translation in `apps/extension/l10n/bundle.l10n.es.json` (and `package.nls.es.json` for manifest text); a test fails when one is missing.
7. After changing settings or commands run `node scripts/gen-reference.mjs` to refresh the reference pages (CI checks they are current).
8. Documentation exists in English and Spanish. When you change a page in `docs/`, update its counterpart in `docs/es/` (or say in the pull request that it still needs it). `node scripts/check-docs-parity.mjs` lists missing pages.

Contribution license: Apache-2.0. How a release is made is in [docs/ci-cd.md](docs/ci-cd.md#making-a-release).

AI agents: read [AGENTS.md](AGENTS.md) first; UI work follows the [design guide](docs/design/design-guide.md). `graphify-out/GRAPH_REPORT.md` is a map of the code.

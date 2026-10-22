# Contribuir / Contributing

1. `pnpm install`. Start the engines you need for tests: `docker compose -f test/compose/docker-compose.yml up -d <engine>` (levanta los motores que necesites).
2. `pnpm lint && pnpm build && pnpm typecheck && pnpm test` must pass. Engine suites skip when their engine is down locally and fail in CI. For the extension also run `pnpm --filter rizomadb test:e2e` (a real VS Code).
3. Branches: work on a branch, open a pull request into **`dev`**; `dev` is promoted to **`main`** with a pull request (the *Promote dev to main* workflow opens it). See [docs/ci-cd.md](docs/ci-cd.md).
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`…). No telemetry, no secrets outside SecretStorage, no `TODO` in finished code.
5. Every new driver must pass `runConformance` from `@rizomadb/driver-api/conformance`, add an engine page to `docs/engines/` and appear in `scripts/gen-reference.mjs`.
6. User-visible text goes through `t()` (host) or the webview strings table, with translations in `apps/extension/l10n/bundle.l10n.es.json`, `bundle.l10n.pt-br.json` and `bundle.l10n.fr.json` (and `package.nls.*.json` for manifest text); a test fails when one is missing.
7. After changing settings or commands run `node scripts/gen-reference.mjs` to refresh the reference pages (CI checks they are current).
8. Important technical decisions: add an ADR in `docs/adr/`.

Contribution license: Apache-2.0.

AI agents: read [AGENTS.md](AGENTS.md) first; UI work follows the [design guide](docs/design/design-guide.md). `graphify-out/GRAPH_REPORT.md` is a map of the code.

## Reviewing a translation
The Portuguese (Brazil) and French texts were written with AI assistance and are waiting for native-speaker review. `node scripts/export-translations.mjs` writes `translation-review/pt-br.csv` and `fr.csv` (English, current text, an empty "corrected" column; placeholders such as `{0}` must stay). Send corrections as a pull request that edits `apps/extension/l10n/bundle.l10n.<lang>.json` and `apps/extension/package.nls.<lang>.json`, or as the filled-in CSV in an issue.

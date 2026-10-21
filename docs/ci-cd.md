# CI/CD

How a change travels from a branch to users, and what is automatic.

```
feature branch ──PR──▶ dev ──PR (Promote workflow)──▶ main ──▶ docs site (GitHub Pages)
                                                         └──tag v*──▶ Release workflow ──▶ (manual approval) marketplaces
```

| Workflow | Runs on | What it does |
|---|---|---|
| `ci.yml` | push and pull request to `main` or `dev` | lint, build, typecheck, licence audit, the test suites against real engine containers, benchmarks, builds the VSIX and keeps it as an artifact (14 days), builds the docs site, scans for secrets (gitleaks) and runs CodeQL. A newer push replaces a run in progress. |
| `pages.yml` | push to `main` that touches `docs/`, `site/` or the workflow, or manual | builds the VitePress site (English and Spanish) and deploys it to GitHub Pages. |
| `promote.yml` | manual | opens the pull request `dev` → `main` if dev has commits main lacks. |
| `release.yml` | tag `v*`, or manual | builds the VSIX, checks its size, generates the SBOM and checksums, attests provenance and attaches them to a prerelease. **Publishing to the Marketplace and Open VSX is a separate step that needs a manual approval.** |

Nothing is published to a marketplace or registry automatically.

## Recommended repository settings
These are repository settings, not code, so they are not applied by the workflows:
- Protect `main` and `dev`: require the `test`, `site`, `secrets` and `codeql` checks to pass, and require a pull request for `main`.
- In Settings → Environments, require a reviewer on the environment the release job publishes with.
- In Settings → Actions → General, allow GitHub Actions to create pull requests (needed by `promote.yml`).

## Local equivalents
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, then `pnpm --filter rizomadb package`. For the site: `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Engines that need containers start with `docker compose -f test/compose/docker-compose.yml up -d <engine>`.

# CI/CD

How a change travels from a branch to users, and what is automatic.

```
feature branch ──PR──▶ dev ──PR (Promote workflow)──▶ main ──▶ docs site (GitHub Pages)
                                                         └──tag v*──▶ Release workflow ──▶ (manual approval) marketplaces
```

| Workflow | Runs on | What it does |
|---|---|---|
| `ci.yml` | push and pull request to `main` or `dev` | lint, build, typecheck, licence audit, a check that the generated reference pages are current, the test suites against real engine containers (a second job, `engines-extra`, starts CockroachDB, YugabyteDB, InfluxDB 3, Firestore and HydraDB from the compose file), benchmarks, builds the VSIX and keeps it as an artifact (14 days), builds the docs site, scans for secrets (gitleaks) and runs CodeQL. A newer push replaces a run in progress. |
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
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, then `node scripts/gen-reference.mjs --check` (or without `--check` to refresh the reference pages), then `pnpm --filter rizomadb package`. For the site: `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Engines that need containers start with `docker compose -f test/compose/docker-compose.yml up -d <engine>`.

## Verifying a release package
Each VSIX in a release comes with `SHA256SUMS`, an SBOM (`sbom.cdx.json`) and a GitHub build-provenance attestation. To check a download:

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify rizomadb-linux-x64.vsix --repo AnderCMD/RizomaDB
```
The attestation proves which workflow run built the file; it is not a code-signing certificate. This path has not run yet, because no release has been made.

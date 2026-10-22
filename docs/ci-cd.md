# CI/CD

How a change travels from a branch to users, and what is automatic.

```
feature branch ──PR──▶ dev ──PR (Promote workflow)──▶ main ──▶ docs site (GitHub Pages)
                                                         └──tag v*──▶ Release workflow ──▶ (manual approval) marketplaces
```

| Workflow | Runs on | What it does |
|---|---|---|
| `ci.yml` | push and pull request to `main` or `dev` | lint, build, typecheck, licence audit, a check that the generated reference pages are current, the test suites against real engine containers (a second job, `engines-extra`, starts CockroachDB, YugabyteDB, InfluxDB 3, Firestore and HydraDB from the compose file), benchmarks, builds the VSIX and keeps it as an artifact (14 days), builds the docs site, builds and smoke-tests the linux-x64 platform VSIX (`platform-package`), scans for secrets (gitleaks) and runs CodeQL. A newer push replaces a run in progress. |
| `pages.yml` | push to `main` that touches `docs/`, `site/` or the workflow, or manual | builds the VitePress site (English, Spanish, Portuguese and French) and deploys it to GitHub Pages. |
| `promote.yml` | manual | opens the pull request `dev` → `main` if dev has commits main lacks. |
| `release.yml` | tag `v*`, or manual | builds the universal VSIX and one VSIX per platform (with DuckDB's native library), checks their size, generates the SBOM and checksums, attests provenance and attaches them to a prerelease. **Publishing to the Marketplace and Open VSX is a separate step that needs a manual approval.** |

Nothing is published to a marketplace or registry automatically.

## Repository settings
These are repository settings, not code, so the workflows do not apply them. Applied on 2026-10-22:
- `main` and `dev` are protected: the `test`, `engines-extra`, `site` and `secrets` checks must pass, and force-pushes and deletions are blocked. Administrators are not forced through pull requests, so the owner can still fast-forward `main` from `dev`.
- The `marketplace` environment (used by the release job to publish) requires a reviewer and only accepts protected branches.
- The default workflow token is read-only and Actions cannot approve pull requests.

Not enabled: letting GitHub Actions create pull requests (Settings → Actions → General), which `promote.yml` needs to open the `dev` → `main` pull request.

## Local equivalents
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, then `node scripts/gen-reference.mjs --check` (or without `--check` to refresh the reference pages), then `pnpm --filter rizomadb package`. For the site: `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Engines that need containers start with `docker compose -f test/compose/docker-compose.yml up -d <engine>`.

## Verifying a release package
Each VSIX in a release comes with `SHA256SUMS`, an SBOM (`sbom.cdx.json`) and a GitHub build-provenance attestation. To check a download:

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify rizomadb-linux-x64.vsix --repo AnderCMD/RizomaDB
```
The attestation proves which workflow run built the file; it is not a code-signing certificate. This path has not run yet, because no release has been made.

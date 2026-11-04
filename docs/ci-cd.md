<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# CI/CD

How a change travels from a branch to users, and what is automatic.

```
feature branch ──PR──▶ dev ──PR (Promote workflow)──▶ main ──▶ docs site (GitHub Pages)
                                                         └──tag v*──▶ Release workflow ──▶ (GitHub release) ──▶ (owner approves `marketplace`) ──▶ Marketplace
```

| Workflow | Runs on | What it does |
|---|---|---|
| `ci.yml` | push and pull request to `main` or `dev` | lint, build, typecheck, licence audit, a check that the generated reference pages are current, the test suites against real engine containers (a second job, `engines-extra`, starts CockroachDB, YugabyteDB, InfluxDB 3, Firestore and HydraDB from the compose file), benchmarks, builds the VSIX and keeps it as an artifact (14 days), builds the docs site, builds and smoke-tests the linux-x64 platform VSIX (`platform-package`), scans for secrets (gitleaks) and runs CodeQL. A newer push replaces a run in progress. |
| `pages.yml` | push to `main` that touches `docs/`, `site/` or the workflow, or manual | builds the VitePress site (English and Spanish) and deploys it to GitHub Pages. |
| `promote.yml` | manual | opens the pull request `dev` → `main` if dev has commits main lacks. |
| `release.yml` | tag `v*`, or manual | builds the universal VSIX and one VSIX per platform (with DuckDB's native library), checks their size, generates the SBOM and checksums, attests provenance and attaches them to the GitHub release (the notes come from `CHANGELOG.md`). A second job, `marketplace`, then publishes the **universal** VSIX to the VS Code Marketplace with `vsce publish --oidc` (trusted publishing: no token or PAT is stored anywhere). It only runs for a tag, and only after the owner approves the `marketplace` environment. The per-platform VSIX files (with DuckDB) stay on the GitHub release only. |

Nothing is published to a marketplace or registry without the owner's approval of the `marketplace` environment. Open VSX is not published.

## Repository settings
These are repository settings, not code, so the workflows do not apply them. Applied on 2026-11-04 (changed from the 2026-10-22 rules):
- `main` is the strict one: a pull request is required (with 0 approvals), the `test`, `engines-extra`, `site` and `secrets` checks must pass, the branch must be up to date with `main` before merging, and the rules apply to administrators too, so the owner cannot skip them. Force-pushes and deletions are blocked. Linear history, signed commits, conversation resolution and code owners are not required.
- `dev` is looser: only the `test` check is required, a pull request is not required (a direct push is possible, but the push must carry a commit whose `test` check has already passed), the rules do not apply to administrators, the branch need not be up to date, and force-pushes and deletions are blocked.
- The default workflow token is read-only and Actions cannot approve pull requests.
- Because `main` must be up to date, a `dev` → `main` pull request goes behind as soon as `main` receives a merge commit; press *Update branch* on the pull request (this runs the checks again).

Not enabled: letting GitHub Actions create pull requests (Settings → Actions → General), which `promote.yml` needs to open the `dev` → `main` pull request.

## Local equivalents
`pnpm lint && pnpm build && pnpm typecheck && pnpm test`, then `node scripts/gen-reference.mjs --check` (or without `--check` to refresh the reference pages), then `pnpm --filter rizomadb-client package`. For the site: `cd site && node sync-docs.mjs && cd .. && pnpm --filter @rizomadb/site build`. Engines that need containers start with `docker compose -f test/compose/docker-compose.yml up -d <engine>`.

## Making a release
1. Bump `version` in `apps/extension/package.json` and add a `## [x.y.z] — date` section to `CHANGELOG.md` and `CHANGELOG.es.md` (the GitHub release notes are taken from the English one).
2. With CI green on `main`, tag it: `git tag -a vX.Y.Z -m "RizomaDB X.Y.Z" && git push origin vX.Y.Z`. The *Release* workflow builds the universal VSIX and the six per-platform ones and attaches them, with `SHA256SUMS`, the SBOM and the build-provenance attestation, to the GitHub release.
3. Download `rizomadb-X.Y.Z.vsix` from the release and check it (`shasum -a 256 -c SHA256SUMS --ignore-missing` and `gh attestation verify rizomadb-X.Y.Z.vsix --repo AnderCMD/RizomaDB`).
4. The *Release* workflow pauses at the `marketplace` job: approve it in the run's *Review deployments* box (or reject it to keep the release on GitHub only). Once approved, the universal VSIX goes to the Marketplace; verification there takes a few minutes.

### One-time setup (already done)
- Marketplace → publisher AnderCMD → *Trusted Publishing*: policy `RizomaDB release`, provider GitHub Actions, owner `AnderCMD`, repository `RizomaDB`, workflow `release.yml`, environment `marketplace`.
- GitHub → Settings → Environments → `marketplace`: required reviewer AnderCMD, deployments limited to tags `v*`.
- Tested: the `v1.2.5` release ran this job and published to the Marketplace through the OIDC exchange, with no token.

## Verifying a release package
Each VSIX in a release comes with `SHA256SUMS`, an SBOM (`sbom.cdx.json`) and a GitHub build-provenance attestation. To check a download:

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify rizomadb-linux-x64.vsix --repo AnderCMD/RizomaDB
```
The attestation proves which workflow run built the file; it is not a code-signing certificate.

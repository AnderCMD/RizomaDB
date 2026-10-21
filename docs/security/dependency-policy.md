# Dependency policy

* Minimum necessary dependencies; each one needs a reason (database driver, SSH, schema validation, formatter).
* Licenses must be on the allow-list in `scripts/license-audit.mjs` (verified by `pnpm audit:licenses --check` in CI). MPL-2.0 is accepted only for unmodified third-party packages.
* Versions are pinned exactly and locked (`pnpm-lock.yaml`); pnpm refuses packages younger than its minimum release age.
* No proprietary driver or client is bundled. External tools (`pg_dump`, `mysqldump`, `mongodump`, …) are detected on `PATH` and run as separate processes.
* Native modules are avoided; DuckDB is the exception and is therefore not shipped in the VSIX.
* Dependabot/Renovate PRs must pass CI including the license check; vulnerabilities rated high/critical block releases.

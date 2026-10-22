# Data handling and compliance notes

## What RizomaDB touches and stores
| Data | Where | Notes |
|---|---|---|
| Passwords, tokens, SSH passphrases | VS Code SecretStorage only | never in settings, history, logs or catalogs |
| Connection profiles | VS Code global state | no secrets |
| Query history | `history.jsonl` in extension storage | SQL redacted for `password=…`; retention `rizomadb.history.retentionDays` |
| Audit trail | local JSONL | literals removed by default |
| Query results | memory only (grid) | row cap `rizomadb.query.maxRows`; exports go where the user saves them |
| SSH known hosts | extension storage + `~/.ssh/known_hosts` | unknown hosts are never auto-trusted |

No data is sent to the project or any third party. The optional AI assistant is **off by default** (`rizomadb.ai.enabled`); when you turn it on, a request goes only to the endpoint you configure (a local model such as Ollama, or a provider you choose), only after you confirm what will be sent, and literals can be redacted first (`rizomadb.ai.redactLiterals`). Nothing is sent without that confirmation, and `disable: ["ai"]` in a policy turns the feature off for everyone.

## Controls matrix
| Control | Implemented by | Evidence |
|---|---|---|
| Access (least privilege) | read-only connections, `prod` read-only default, per-engine server-side read-only where available | `policy-paths.test.ts`, driver conformance read-only tests |
| Change control | edit queue with exact SQL, transactional apply, approvals, confirmations | `editing.test.ts` on 5 engines |
| Logging | local audit trail, blocked attempts included | `policy-engine.test.ts` |
| Data minimisation | masking in grid/exports, literal-free audit | export/mask tests |
| Transport security | TLS verify on by default, SSH host-key pinning | `network` tests |
| Supply chain | lockfile, license audit, CycloneDX SBOM, provenance, gitleaks, CodeQL (all run on every push in the CI workflow) | `.github/workflows` |

This matrix describes the software, not an organisation's compliance: you still need your own risk assessment.

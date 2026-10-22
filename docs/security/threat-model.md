<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Threat model (STRIDE) — initial draft

Assets: database credentials, queried data, history and audit log, integrity of written data, supply chain.

| Threat | Category | Control |
|---|---|---|
| A secret ends up in settings, logs or history | Information disclosure | Only SecretStorage; a central redactor; tests |
| A webview injects messages | Tampering / elevation of privilege | Strict CSP, zod validation at both ends, minimal localResourceRoots |
| Generated SQL with injection | Tampering | Escaping of identifiers and literals, parameters, fuzzing |
| An untrusted workspace loads connections or policies | Elevation of privilege | Workspace Trust: restricted mode |
| Accidental write to production | Tampering | Environment labels, read-only on server and client, a reviewable queue |
| MITM / TLS turned off | Spoofing | TLS verified by default, a visible warning, SSH fingerprints |
| Compromised dependency | Tampering | Lockfile, audit, SBOM, provenance |
| Leak through AI / MCP | Information disclosure | Off by default, schema only, confirmation, audit |
| Repudiation of operations | Repudiation | Local JSONL audit log |
| DoS through huge results | Denial of service | Row and memory limits, streaming, workers |

This document is kept alive and reviewed at each phase.

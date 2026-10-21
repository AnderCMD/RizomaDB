# Audit trail

Every statement executed through RizomaDB is appended to a local JSONL file (default: the extension's storage folder; `rizomadb.audit.path` overrides it). Nothing is sent anywhere.

Fields: `ts`, `user` (OS user), `connection`, `environment`, `engine`, `kind` (SELECT/UPDATE/…), `statement`, `status` (`ok`, `error`, `blocked`, `cancelled`), `rows`, `durationMs`, `detail`.

* **No data by default:** string, number and hex literals are replaced by `?` (`rizomadb.audit.includeValues` keeps them). Policy-blocked statements are logged too.
* **Rotation:** at 5 MB the file is renamed `audit-<timestamp>.jsonl`; the latest 5 are kept.
* **Viewer:** *RizomaDB: Open Audit Log* (filter all / blocked / errors / succeeded). *Export Audit Log…* writes one JSONL file for your SIEM.
* The file is created with mode 0600. It is local evidence, not tamper-proof: forward it to a system you trust if you need that.

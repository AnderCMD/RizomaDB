<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Policies

RizomaDB merges policy layers and the **strictest result always wins**: a project file can tighten what the team set, a user file can tighten what the project set, nobody can loosen what a higher layer restricted.

| Layer | Where | Loaded when |
|---|---|---|
| Built-in | the extension | always (`rizomadb.security.prodReadOnlyByDefault` can turn off only this layer's `prod` read-only default) |
| Team | VS Code setting `rizomadb.policy.team` (deploy it as a managed/machine setting) | always |
| Project | `.rizomadb/policy.json` in each workspace folder | **trusted workspaces only** |
| User | `policy.json` in the extension's global storage | always |

A policy file that cannot be read or validated makes everything read-only until it is fixed (fail closed) and shows the error in the *RizomaDB policy* output channel.

## Custom environments
Besides `dev`, `staging` and `prod` a person can add environments in the connection form (**New environment…**) or in the `rizomadb.environments` setting: `{ "name": "qa", "protection": "confirm" }` where protection is `none`, `confirm` (ask before every write) or `readOnly` (block writes). Those become an extra policy layer, so they can only add strictness; the `environments` section of a policy file below can describe the same name in more detail and the strictest result wins.

## Format (`version: 1`)
```json
{
  "version": 1,
  "defaults": { "maxRows": 100000 },
  "environments": {
    "prod": { "readOnly": true, "requireApproval": true, "timeoutSeconds": 30, "maxRows": 10000 },
    "staging": { "deny": ["drop", "truncate"], "confirmWrites": true },
    "qa": { "allow": ["select", "insert", "update"] }
  },
  "disable": ["ai", "backup", "restore"],
  "maskColumns": [{ "column": "/email|phone/i", "rule": "redact" }, { "column": "ssn", "rule": "last4" }]
}
```
* `readOnly` blocks every write. `allow` (intersected across layers) and `deny` (unioned) restrict statement kinds: `select insert update delete merge create alter drop truncate grant revoke execute`.
* `requireApproval`: the user must type the connection name before any change runs.
* `confirmDestructive`, `confirmWrites`: ask before destructive / all writes. A user preference can switch off the routine destructive prompt but never a confirmation the policy requires.
* `maxRows`, `timeoutSeconds`: the smallest value across layers applies to every query.
* `disable`: switches commands off for everyone (`ai`, `export`, `import`, `backup`, `restore`, `dataSync`, `designer`, `admin`).
* `maskColumns`: names or `/regex/`; rules `redact`, `nullify`, `hash`, `last4`. Masked results are shown masked, cannot be edited in the grid, and are exported masked.

## What is guaranteed, and how
All connections handed to features are wrapped by a **guarded connection** (`packages/core/src/guard.ts`): one policy check and one audit entry per statement, for the editor, the grid, imports, schema tools, data sync, notebooks and admin tools alike. `packages/data-tools/src/policy-paths.test.ts` exercises each of those paths against a `prod` connection and asserts the data does not change.

Limits you should know about:
* Classification is **static and default-deny** (`assessStatement`): a statement is a read only if it starts with a known read keyword and contains no write keyword; anything unrecognised counts as a write. It cannot see side effects hidden in functions (`SELECT nextval(...)`, `SELECT pg_terminate_backend(...)`). For hard guarantees use a database account with read-only privileges; where the engine offers a server-side read-only mode, RizomaDB also sets it.
* Policy protects against mistakes and against RizomaDB features misbehaving. A person with their own database credentials and another client can still write: this is not a replacement for database permissions.

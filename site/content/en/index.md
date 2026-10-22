---
layout: home
hero:
  name: RizomaDB
  text: All your databases, one place.
  tagline: A free, open-source, no-telemetry database client for VS Code. 25 engines, one results grid, safe by default.
  image: { src: /logo.svg, alt: RizomaDB }
  actions:
    - { theme: brand, text: Get started, link: /en/guides/getting-started }
    - { theme: alt, text: Engines, link: /en/reference/engine-matrix }
    - { theme: alt, text: GitHub, link: "https://github.com/AnderCMD/RizomaDB" }
features:
  - { icon: "🔌", title: "Connect from a screen of logos", details: "Pick your engine; host, port and user are already filled in. Environments with protection, SSH tunnels, proxies, secrets only in VS Code's secret storage.", link: /en/guides/connections }
  - { icon: "▶️", title: "A Run button above every statement", details: "Run, Explain, Run all, parameters, a searchable history and notebooks, in each engine's own language.", link: /en/guides/query-editor }
  - { icon: "🗂️", title: "A results grid made for exploring", details: "Sort, filter in the rows or in the database, resize, hide, record panel, copy as CSV/JSON/Markdown, and Load more on every engine.", link: /en/guides/results-grid }
  - { icon: "✏️", title: "Edit in place, safely", details: "Double-click a cell. Changes wait as pending; review the SQL and apply them in one transaction, with conflict detection.", link: /en/guides/editing-data }
  - { icon: "🛡️", title: "Safe by default", details: "Layered policies where the strictest wins, one audit point for every write, read-only production, column masking.", link: /en/enterprise/policy }
  - { icon: "🌍", title: "English and Spanish", details: "Switch the language inside the extension, and follow the built-in guide that takes you by the hand.", link: /en/guides/language-and-settings }
---

::: warning Version 1.0.0
RizomaDB 1.0.0 is on the VS Code Marketplace (Open VSX is not published yet), but some things are not confirmed. The [honest comparison](/en/market/honest-comparison) and the [acceptance checklist](/en/release/v1-checklist) say exactly what is and is not verified.

**Cloud services are not confirmed.** RizomaDB has only been tested against local engines and official emulators, never against a real cloud account (AWS, Google Cloud, MongoDB Atlas, managed PostgreSQL/MySQL). Test with a read-only user or a throwaway database before relying on it: see [Cloud and managed services](/en/engines/#cloud-and-managed-services-not-confirmed).
:::

## Where to start
- New here: [Getting started](/en/guides/getting-started), then [Connections](/en/guides/connections).
- Coming from another tool: [Migrating to RizomaDB](/en/guides/migration) and the [honest comparison](/en/market/honest-comparison).
- Looking for an engine: the [capability matrix](/en/reference/engine-matrix) and the [engine pages](/en/engines/README).
- Rolling it out to a team: [Policies](/en/enterprise/policy), [Deployment](/en/enterprise/deployment) and [Compliance](/en/enterprise/compliance).
- Something wrong: [Troubleshooting](/en/guides/troubleshooting).

<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Help test RizomaDB

RizomaDB has been tested against local engines, containers and official emulators, by one person. It has **not** been tested against real cloud accounts or by many people on many systems, and that is where bugs are most likely to hide. If you can run any of the following, a short report is valuable, **whether it worked or not**.

## What is most useful
1. **Cloud and managed services**: Amazon DynamoDB on AWS, Google Cloud Firestore, MongoDB Atlas, and managed PostgreSQL/MySQL (RDS, Aurora, Cloud SQL, Azure Database, Neon, Supabase, PlanetScale). See [Cloud and managed services](../engines/README.md#cloud-and-managed-services-not-confirmed).
2. **Other operating systems and screen readers**: Windows and Linux with NVDA, JAWS or Orca; a keyboard-only run through the screens ([Using the keyboard](keyboard.md)).
3. **Your own databases**: bigger tables, odd column types, slow networks, SSH tunnels and proxies.

## How to test safely
- Use a **read-only user** or a throwaway database. Turn on the connection's read-only switch first.
- Walk through the steps in the report form: connect, browse, run a query, load more, sort and filter. Edit data only on a table you can lose.
- Nothing is sent anywhere by RizomaDB: there is no telemetry. A report only exists if you write it.

## How to report
Open a **Test report** issue on GitHub (the form lists the steps to tick). Say the engine and version, where it runs, your system, what worked and, for a failure, the exact message. **Never paste passwords, tokens, keys or private data.** The *RizomaDB policy* output channel and the status bar show what blocked an action.

A report that says "it works" is as useful as a bug: it is the only way a service can move from "not confirmed" to "tested".

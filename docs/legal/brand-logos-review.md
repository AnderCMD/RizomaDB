# Engine logos: sheet for the legal review

For whoever reviews the logo use before the first public release. It lists what is shown, where each file comes from, and the points that need a judgement. This is a preparation sheet, **not legal advice**; the policy itself is in [brand-logos.md](brand-logos.md).

## Where each mark comes from

| Engine key(s) | Source set | Licence of the file | Mark owner (as far as the project knows) |
|---|---|---|---|
| postgres, mysql, mariadb, sqlite, cockroach, tidb, clickhouse, duckdb, trino, mongodb, redis, elasticsearch, opensearch, neo4j, cassandra, scylla | simple-icons | CC0-1.0 | PostgreSQL Community Association, Oracle/MySQL, MariaDB Foundation, SQLite (public domain code, no owner of the name), Cockroach Labs, PingCAP, ClickHouse, DuckDB Foundation, Trino Software Foundation, MongoDB Inc., Redis Ltd., Elastic, OpenSearch (Amazon), Neo4j, Apache Software Foundation, ScyllaDB |
| influxdb, influxdb3 | simple-icons (**the same InfluxDB mark for both**) | CC0-1.0 | InfluxData |
| firestore | simple-icons "Firebase" mark | CC0-1.0 | Google |
| oracle | gilbarbara/logos via `@iconify-json/logos`, **cropped by the project** | CC0-1.0 | Oracle |
| dynamodb | gilbarbara/logos ("AWS DynamoDB") | CC0-1.0 | Amazon |
| valkey | gilbarbara/logos | CC0-1.0 | Linux Foundation |
| yugabyte | gilbarbara/logos | CC0-1.0 | Yugabyte |
| mssql | devicon ("Microsoft SQL Server") | MIT | Microsoft |

The licences cover the SVG files only. They say nothing about the trademark.

## Points that need a decision

1. **Nominative use.** The marks identify the engine a connection talks to, in the connection list, tabs and cards. The screen says RizomaDB is not affiliated with any owner. Is that enough for each owner's published brand guidelines?
2. **Oracle is modified.** The published logo is a wordmark; the project keeps only the red "O" outline and counter (`scripts/gen-logos.mjs`). Some owners forbid altering their logos.
3. **Firestore uses the Firebase mark**, and InfluxDB 3 reuses the InfluxDB mark. Do these imply a product the engine is not?
4. **Colour handling.** Marks are drawn on a light or dark background chosen for contrast; fills are not recoloured otherwise.
5. **Owners that restrict third-party use.** Check each owner's brand page for terms that apply to software that merely connects to the product (Oracle, Microsoft, Amazon, Google, MongoDB, Elastic, Redis are the ones most likely to have written rules).
6. **Distribution.** The marks ship inside the VSIX (`engineLogos.ts`) and appear on the project site and README. Does that change the answer?

## If an owner objects

Delete its entry from `ENGINE_LOGOS` in `apps/extension/src/engineLogos.ts` (or from `scripts/gen-logos.mjs` and regenerate). The screen falls back to a RizomaDB monogram tile and nothing else changes.

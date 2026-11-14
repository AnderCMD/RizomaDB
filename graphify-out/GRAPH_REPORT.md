# Graph Report - RizomaDB  (2026-11-14)

## Corpus Check
- 401 files · ~219,336 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3737 nodes · 6105 edges · 257 communities (230 shown, 27 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 141 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2190a2ac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.ts
- completion.ts
- diff.ts
- mongodb/src/index.ts
- extension.ts
- redis/src/index.ts
- proxy.ts
- ConnectionManager
- influxdb3/src/index.ts
- firestore/src/index.ts
- devDependencies
- workerDriver.ts
- devDependencies
- dynamodb/src/index.ts
- clickhouse/src/index.ts
- neo4j/src/index.ts
- dependencies
- dependencies
- influxdb/src/index.ts
- devDependencies
- providers.ts
- elasticsearch/src/index.ts
- postgres/src/index.ts
- trino/src/index.ts
- server.ts
- connections.ts
- catalog.ts
- ai/src/index.ts
- connect.ts
- data-tools/package.json
- aiCommands.ts
- conformance.ts
- build-brand.mjs
- soak.mjs
- export.ts
- duckdb/src/index.ts
- nosqlCommands.ts
- import.test.ts
- rizomadb.format.dataTypeCase
- postgres/package.json
- sqlite/src/index.ts
- redis/package.json
- k
- jdbcUrl.ts
- compare.ts
- mongodb/package.json
- cassandra/package.json
- tokenizer.ts
- webview/er.ts
- mysql/package.json
- oracle/package.json
- queryBuilder.ts
- webview/history.ts
- plan.ts
- logoSvg.ts
- dynamodb/package.json
- elasticsearch/package.json
- firestore/package.json
- hydradb/package.json
- influxdb3/package.json
- influxdb/package.json
- mssql/src/index.ts
- neo4j/package.json
- trino/package.json
- schema-tools/package.json
- ui.ts
- duckdb/package.json
- hydradb/src/index.ts
- types.ts
- connectionPanel.ts
- mssql/package.json
- admin/package.json
- network/package.json
- statements.ts
- driver-api/package.json
- sqlite/package.json
- effective-policy.ts
- admin.test.ts
- tasks
- gen-logos.mjs
- PendingEdits
- ai/package.json
- tools.test.ts
- package-platform.mjs
- MssqlConnection
- extension/package.json
- contributes
- designer.ts
- hydradb.test.ts
- compilerOptions
- explain.ts
- editing.ts
- parse.ts
- mysql/src/index.ts
- oracle/src/index.ts
- engines.integration.test.mts
- policy-engine.test.ts
- lib.test.ts
- resultsPanel.ts
- historyPanel.ts
- site/package.json
- compilerOptions
- rizomadb.editor.highlightStatement
- devDependencies
- rizomadb.environments
- activation.test.ts
- make-screenshot-data.mjs
- admin/tsconfig.json
- ai/tsconfig.json
- core/tsconfig.json
- data-tools/tsconfig.json
- intelligence.test.ts
- driver-api/tsconfig.json
- cassandra/tsconfig.json
- clickhouse/tsconfig.json
- duckdb/tsconfig.json
- dynamodb/tsconfig.json
- elasticsearch/tsconfig.json
- firestore/tsconfig.json
- hydradb/tsconfig.json
- influxdb3/tsconfig.json
- influxdb/tsconfig.json
- mongodb/tsconfig.json
- mssql/tsconfig.json
- .execute
- mysql/tsconfig.json
- neo4j/tsconfig.json
- oracle/tsconfig.json
- postgres/tsconfig.json
- redis/tsconfig.json
- sqlite/tsconfig.json
- trino/tsconfig.json
- mcp/tsconfig.json
- network/tsconfig.json
- schema-tools/tsconfig.json
- sql/tsconfig.json
- license-audit.mjs
- test-engines/tsconfig.json
- dependencies
- generate.ts
- scope.ts
- rizomadb.language
- rizomadb.results.location
- ConnectionLoss
- rizomadb.format.indentStyle
- DriverPlugin
- rizomadb.ai.provider
- rizomadb.format.logicalOperatorNewline
- IntrospectionApi
- rizomadb.format.expressionWidth
- keywords
- scripts
- i18n.test.ts
- ExecuteRequest
- security.test.ts
- Cursor
- bench/run.mjs
- activationEvents
- rizomadb.catalog.teamFile
- rizomadb.history.retentionDays
- rizomadb.policy.team
- rizomadb.query.maxRows
- rizomadb.query.pageSize
- properties
- rizomadb.table.openRows
- encryptedCatalog.ts
- cassandra/src/index.ts
- rizomadb.edit.withoutPrimaryKey
- config.mts
- rizomadb.format.linesBetweenQueries
- rizomadb.format.denseOperators
- rizomadb.format.newlineBeforeSemicolon
- rizomadb.ai.enabled
- rizomadb.ai.endpoint
- rizomadb.ai.model
- untrustedWorkspaces
- rizomadb.ai.redactLiterals
- Admin
- rizomadb.audit.path
- Dialect
- MysqlConnection
- rizomadb.editor.codeLens
- rizomadb.history.enabled
- rizomadb.mcp.autoRegister
- rizomadb.security.confirmDestructive
- e2e/run.mjs
- OracleConnection
- rizomadb.explorer.groupByFamily
- uiLanguage.test.ts
- editing.test.ts
- esbuild.mjs
- policy-paths.test.ts
- tableProperties
- CassandraConnection
- readOnlyUser.integration.test.mts
- sql/src/index.ts
- Value
- columnStats
- @rizomadb/driver-oracle
- @rizomadb/driver-mongodb
- @rizomadb/driver-mssql
- @rizomadb/driver-redis
- @rizomadb/sql
- zod
- check-vsix-size.mjs
- wait-engines.mjs
- prepare.mjs
- smoke-vsix-duckdb.mjs
- tidb.test.ts
- take-screenshots.mjs
- tr
- rizomadb.connections.idleMinutes
- mysql.test.ts
- gen-reference.mjs
- test-engines/src/index.ts
- Provider
- rizomadb.edit.applyImmediately
- mcpProvider.ts
- @rizomadb/core
- pg
- t
- check-docs-parity.mjs
- rizomadb.security.prodReadOnlyByDefault
- rizomadb.audit.includeValues

## God Nodes (most connected - your core abstractions)
1. `ConnectionManager` - 56 edges
2. `t()` - 50 edges
3. `tr()` - 50 edges
4. `v()` - 27 edges
5. `k()` - 27 edges
6. `openConnectionScreen()` - 26 edges
7. `el()` - 25 edges
8. `iconButton()` - 25 edges
9. `onMessage()` - 24 edges
10. `vscode` - 24 edges

## Surprising Connections (you probably didn't know these)
- `saveSecrets()` --indirect_call--> `v()`  [INFERRED]
  packages/core/src/secrets.ts → apps/extension/src/lib/jdbcUrl.test.ts
- `docsToEvents()` --indirect_call--> `v()`  [INFERRED]
  packages/drivers/elasticsearch/src/index.ts → apps/extension/src/lib/jdbcUrl.test.ts
- `parse()` --indirect_call--> `v()`  [INFERRED]
  packages/drivers/influxdb3/src/index.ts → apps/extension/src/lib/jdbcUrl.test.ts
- `parseJson()` --indirect_call--> `v()`  [INFERRED]
  packages/drivers/trino/src/index.ts → apps/extension/src/lib/jdbcUrl.test.ts
- `parseMysqlPlan()` --indirect_call--> `v()`  [INFERRED]
  packages/sql/src/explain.ts → apps/extension/src/lib/jdbcUrl.test.ts

## Import Cycles
- None detected.

## Communities (257 total, 27 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.02
Nodes (96): parsePasted(), actionRow, api, applyFilter(), body, btnApply, btnColumns, btnCopy (+88 more)

### Community 1 - "completion.ts"
Cohesion: 0.14
Nodes (19): complete(), CompletionItem, CompletionKind, lc(), needsQuote(), ord(), quoteIfNeeded(), resolve() (+11 more)

### Community 2 - "diff.ts"
Cohesion: 0.07
Nodes (63): ColumnOp, columnStatements(), lc(), addFk(), assertFragment(), assertIdentifier(), columnDef(), createIndex() (+55 more)

### Community 3 - "mongodb/src/index.ts"
Cohesion: 0.05
Nodes (42): Assessment, assessMongo(), DESTRUCTIVE, hasOut(), isEmpty(), READ_COLLECTION, READ_COMMANDS, READ_DB (+34 more)

### Community 4 - "extension.ts"
Cohesion: 0.12
Nodes (23): DesignerToHost, activate(), cfg(), makeRegistry(), stripLeadingComments(), ColumnAction, DEFAULT_TYPE, runColumnAction() (+15 more)

### Community 5 - "redis/src/index.ts"
Cohesion: 0.11
Nodes (21): asValue(), col(), mapError(), pairs(), RedisConnection, redisDriver, row(), Shape (+13 more)

### Community 6 - "proxy.ts"
Cohesion: 0.06
Nodes (48): checkHostKey(), createHmacless(), entriesFor(), fingerprint(), formatEntry(), glob(), HostKeyDecision, HostKeyEntry (+40 more)

### Community 7 - "ConnectionManager"
Cohesion: 0.09
Nodes (9): ConnectionManager, takeProxy(), takeSsh(), loadModel(), openConnectionScreen(), engineOf(), Explorer, newConnectionWizard() (+1 more)

### Community 8 - "influxdb3/src/index.ts"
Cohesion: 0.11
Nodes (16): Client, HttpError, Influx3Connection, influxdb3Driver, kindOfValue(), mapError(), orderColumns(), paramValue() (+8 more)

### Community 9 - "firestore/src/index.ts"
Cohesion: 0.06
Nodes (43): RFC-7523, assessFirestore(), Command, ConsoleSyntaxError, isStr(), Op, opName(), OPS (+35 more)

### Community 10 - "devDependencies"
Cohesion: 0.05
Nodes (41): axe-core, eslint, @eslint/js, @fontsource/inter, opentype.js, devDependencies, axe-core, eslint (+33 more)

### Community 11 - "workerDriver.ts"
Cohesion: 0.08
Nodes (20): drivers, iters, Target, targets, ConnectResult, NextResult, Request, Response (+12 more)

### Community 12 - "devDependencies"
Cohesion: 0.05
Nodes (40): dependencies, @rizomadb/driver-api, zod, devDependencies, fast-check, mongodb, mysql2, oracledb (+32 more)

### Community 13 - "dynamodb/src/index.ts"
Cohesion: 0.06
Nodes (37): AwsKeys, awsKeysFromEnv(), AwsProfileError, Ini, loadAwsProfile(), parseIni(), env, files (+29 more)

### Community 14 - "clickhouse/src/index.ts"
Cohesion: 0.07
Nodes (29): @clickhouse/client, dependencies, @clickhouse/client, @rizomadb/driver-api, exports, ./meta, @rizomadb/driver-api, license (+21 more)

### Community 15 - "neo4j/src/index.ts"
Cohesion: 0.09
Nodes (22): assessCypher(), Risk, stripCypher(), Client, CypherError, decode(), kindOf(), mapError() (+14 more)

### Community 16 - "dependencies"
Cohesion: 0.05
Nodes (38): bin, rizomadb-mcp, dependencies, @rizomadb/core, @rizomadb/data-tools, @rizomadb/driver-api, @rizomadb/driver-mssql, @rizomadb/driver-mysql (+30 more)

### Community 17 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, mysql2, oracledb, pg, @rizomadb/driver-api, @rizomadb/driver-mssql, @rizomadb/driver-mysql, @rizomadb/driver-oracle (+29 more)

### Community 18 - "influxdb/src/index.ts"
Cohesion: 0.10
Nodes (19): CsvReader, RFC-4180, assessFlux(), stripFlux(), Client, convert(), csvToEvents(), HttpError (+11 more)

### Community 19 - "devDependencies"
Cohesion: 0.05
Nodes (36): dependencies, @rizomadb/driver-api, sql-formatter, devDependencies, fast-check, mysql2, oracledb, pg (+28 more)

### Community 20 - "providers.ts"
Cohesion: 0.23
Nodes (9): assertName(), grantStatement(), lit(), mssql, mysql, oracle, postgres, PRIVS (+1 more)

### Community 21 - "elasticsearch/src/index.ts"
Cohesion: 0.10
Nodes (21): assessConsole(), ConsoleRequest, ConsoleSyntaxError, parseConsole(), Risk, stripJsonComments(), bsonish(), Client (+13 more)

### Community 22 - "postgres/src/index.ts"
Cohesion: 0.08
Nodes (18): base, port, kindOf(), mapError(), PgConnection, postgresDriver, run(), Runner (+10 more)

### Community 23 - "trino/src/index.ts"
Cohesion: 0.10
Nodes (21): base(), Client, convert(), HttpError, kindOf(), literal(), makeClient(), mapError() (+13 more)

### Community 24 - "server.ts"
Cohesion: 0.10
Nodes (22): main(), loaders, loadMcpConfig(), Mask, McpConfig, formatValue(), checkAgentQuery(), defaultRule() (+14 more)

### Community 25 - "connections.ts"
Cohesion: 0.11
Nodes (15): CatalogProfile, DriverRegistry, base, memento(), setup(), Memento, OpenTunnel, SshSettings (+7 more)

### Community 26 - "catalog.ts"
Cohesion: 0.20
Nodes (9): CatalogFile, CatalogResult, findSecrets(), loadCatalog(), readTextWithin(), FAIL_CLOSED, LoadedPolicy, loadPolicy() (+1 more)

### Community 27 - "ai/src/index.ts"
Cohesion: 0.11
Nodes (22): fks, schema, servers, AiConfig, AiDeclinedError, AiDisabledError, Answer, extractSql() (+14 more)

### Community 28 - "connect.ts"
Cohesion: 0.10
Nodes (38): v(), HostToSettings, Item, SettingsToHost, Conn, conns, EditInfo, el() (+30 more)

### Community 29 - "data-tools/package.json"
Cohesion: 0.07
Nodes (26): dependencies, @rizomadb/core, @rizomadb/driver-api, devDependencies, fast-check, mongodb, @rizomadb/driver-postgres, @rizomadb/driver-sqlite (+18 more)

### Community 30 - "aiCommands.ts"
Cohesion: 0.14
Nodes (10): DIALECT_OF, SchemaCache, withTimeout(), Deps, registerAiCommands(), CASES, formatOptions(), KIND (+2 more)

### Community 31 - "conformance.ts"
Cohesion: 0.17
Nodes (10): ConformanceOptions, ctx, engineUp(), reachable(), runConformance(), DriverError, DriverErrorKind, ResolvedConnectionConfig (+2 more)

### Community 32 - "build-brand.mjs"
Cohesion: 0.10
Nodes (22): C, files, font, glyph(), horizontal(), lum(), markMono, markTile (+14 more)

### Community 33 - "soak.mjs"
Cohesion: 0.10
Nodes (23): EditableRedisType, port, rows(), run(), isEditableRedisType(), isStreamEntryId(), q(), readCommand() (+15 more)

### Community 34 - "export.ts"
Cohesion: 0.17
Nodes (18): csvCell(), decrypt(), ExportFormat, ExportOptions, exportResult(), hex(), jsonReplacer(), require_decipher() (+10 more)

### Community 35 - "duckdb/src/index.ts"
Cohesion: 0.14
Nodes (13): convert(), DuckConnection, duckdbDriver, isReadOnlySafe(), kindOf(), mapError(), run(), SAFE_MAX (+5 more)

### Community 36 - "nosqlCommands.ts"
Cohesion: 0.16
Nodes (17): commandAt(), cypherStatementAt(), isQueryLanguage(), QUERY_LANGUAGES, AnalysisLabels, analysisMarkdown(), analyzeDocuments(), EN (+9 more)

### Community 37 - "import.test.ts"
Cohesion: 0.14
Nodes (16): batchLimits(), ConversionError, convertCell(), convertNonString(), ConvertOptions, DEFAULT_FALSE, DEFAULT_TRUE, ImportMapping (+8 more)

### Community 38 - "rizomadb.format.dataTypeCase"
Cohesion: 0.11
Nodes (21): rizomadb.format.dataTypeCase, rizomadb.format.functionCase, rizomadb.format.keywordCase, default, enum, markdownDescription, scope, type (+13 more)

### Community 39 - "postgres/package.json"
Cohesion: 0.09
Nodes (22): dependencies, pg, pg-cursor, @rizomadb/driver-api, devDependencies, @types/pg, exports, ./meta (+14 more)

### Community 40 - "sqlite/src/index.ts"
Cohesion: 0.15
Nodes (11): fromSql(), kindOf(), mapError(), run(), SqliteConnection, sqliteDriver, throwIfAborted(), toSql() (+3 more)

### Community 41 - "redis/package.json"
Cohesion: 0.09
Nodes (21): ioredis, dependencies, ioredis, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta (+13 more)

### Community 42 - "k"
Cohesion: 0.18
Nodes (12): k(), decide(), ConnectionProfile, Environment, parseProfile(), redactObject(), redactString(), expandVariables() (+4 more)

### Community 43 - "jdbcUrl.ts"
Cohesion: 0.20
Nodes (23): Authority, dec(), cases, falsy(), finish(), JDBC_DRIVERS, JdbcConnection, JdbcUrlError (+15 more)

### Community 44 - "compare.ts"
Cohesion: 0.24
Nodes (11): applySync(), ApplySyncOptions, canon(), CompareOptions, DataDiff, diffTables(), literal(), renderSyncScript() (+3 more)

### Community 45 - "mongodb/package.json"
Cohesion: 0.09
Nodes (21): dependencies, mongodb, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, ./parser (+13 more)

### Community 46 - "cassandra/package.json"
Cohesion: 0.10
Nodes (20): cassandra-driver, dependencies, cassandra-driver, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta (+12 more)

### Community 47 - "tokenizer.ts"
Cohesion: 0.30
Nodes (10): bindParameters(), findParameters(), lcName(), Parameter, paramTokens(), isWordPart(), isWordStart(), Token (+2 more)

### Community 48 - "webview/er.ts"
Cohesion: 0.18
Nodes (8): Col, draw(), Edge, mk(), Msg, Node, svg, vscode

### Community 49 - "mysql/package.json"
Cohesion: 0.10
Nodes (20): dependencies, mysql2, @rizomadb/driver-api, devDependencies, pg, exports, ./meta, mysql2 (+12 more)

### Community 50 - "oracle/package.json"
Cohesion: 0.10
Nodes (20): dependencies, oracledb, @rizomadb/driver-api, devDependencies, @types/oracledb, exports, ./meta, oracledb (+12 more)

### Community 51 - "queryBuilder.ts"
Cohesion: 0.15
Nodes (14): BuilderColumn, BuilderError, BuilderInput, BuilderKind, buildSelect(), Condition, cols, engines (+6 more)

### Community 52 - "webview/history.ts"
Cohesion: 0.12
Nodes (18): HostToHistory, api, chips, clear, conn, count, field, Item (+10 more)

### Community 53 - "plan.ts"
Cohesion: 0.21
Nodes (8): table, el(), fmt(), isMsg(), isNode(), Msg, Node, render()

### Community 54 - "logoSvg.ts"
Cohesion: 0.24
Nodes (14): EngineLogo, LogoShape, esc(), hasGradient(), logoDataUri(), logoSvg(), node(), adaptHex() (+6 more)

### Community 55 - "dynamodb/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 56 - "elasticsearch/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 57 - "firestore/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 58 - "hydradb/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 59 - "influxdb3/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 60 - "influxdb/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 61 - "mssql/src/index.ts"
Cohesion: 0.16
Nodes (15): ColumnMetaData, isReadOnlySafe(), Item, kindOf(), mapError(), mssqlDriver, normalize(), param() (+7 more)

### Community 62 - "neo4j/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 63 - "trino/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 64 - "schema-tools/package.json"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, @rizomadb/sql, devDependencies, @rizomadb/test-engines, @rizomadb/driver-api, @rizomadb/sql, @rizomadb/test-engines (+10 more)

### Community 65 - "ui.ts"
Cohesion: 0.09
Nodes (24): esc(), iconBtn(), iconSvg(), api, done, go(), ic(), postMessage() (+16 more)

### Community 66 - "duckdb/package.json"
Cohesion: 0.11
Nodes (17): @duckdb/node-api, dependencies, @duckdb/node-api, @rizomadb/driver-api, exports, ./meta, @rizomadb/driver-api, license (+9 more)

### Community 67 - "hydradb/src/index.ts"
Cohesion: 0.16
Nodes (11): Cell, decode(), HydraConnection, HydraError, kindOf(), makeClient(), mapError(), Opts (+3 more)

### Community 68 - "types.ts"
Cohesion: 0.12
Nodes (16): Capabilities, ColumnDef, ColumnInfo, DriverContext, EditTargetRef, EngineFamily, ForeignKey, IndexInfo (+8 more)

### Community 69 - "connectionPanel.ts"
Cohesion: 0.07
Nodes (30): assert, vscode, ConnectForm, ConnectToHost, HostToConnect, short, Engine, EngineFamily (+22 more)

### Community 70 - "mssql/package.json"
Cohesion: 0.11
Nodes (17): dependencies, @rizomadb/driver-api, tedious, exports, ./meta, @rizomadb/driver-api, tedious, license (+9 more)

### Community 71 - "admin/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @rizomadb/driver-api, devDependencies, @rizomadb/test-engines, @rizomadb/driver-api, @rizomadb/test-engines, license, main (+8 more)

### Community 72 - "network/package.json"
Cohesion: 0.12
Nodes (16): dependencies, ssh2, devDependencies, @types/ssh2, license, main, name, scripts (+8 more)

### Community 73 - "statements.ts"
Cohesion: 0.20
Nodes (18): onlyComments(), SplitOptions, splitStatements(), Statement, statementAt(), texts(), blockRanges(), cache (+10 more)

### Community 74 - "driver-api/package.json"
Cohesion: 0.12
Nodes (15): exports, ./conformance, vitest, license, main, name, peerDependencies, vitest (+7 more)

### Community 75 - "sqlite/package.json"
Cohesion: 0.12
Nodes (15): dependencies, @rizomadb/driver-api, exports, ./meta, @rizomadb/driver-api, license, main, name (+7 more)

### Community 76 - "effective-policy.ts"
Cohesion: 0.13
Nodes (21): AuditEntry, decideEffective(), EffectiveDecision, EffectivePolicy, EnvRule, inter(), mergeRule(), minOf() (+13 more)

### Community 77 - "admin.test.ts"
Cohesion: 0.16
Nodes (11): MetricSampler, snapshotToRecord(), Table, priv(), setup(), sig(), x(), Engine (+3 more)

### Community 78 - "tasks"
Cohesion: 0.15
Nodes (14): ^build, dist/**, RZ_*, .vitepress/dist/**, dependsOn, outputs, globalPassThroughEnv, $schema (+6 more)

### Community 79 - "gen-logos.mjs"
Cohesion: 0.14
Nodes (11): ATTRS, gil(), logos, oracle, out, parse(), req, si (+3 more)

### Community 80 - "PendingEdits"
Cohesion: 0.16
Nodes (4): PendingEdits, same(), rows, target

### Community 81 - "ai/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rizomadb/core, @rizomadb/core, license, main, name, scripts, build (+5 more)

### Community 82 - "tools.test.ts"
Cohesion: 0.24
Nodes (12): BackupEngine, backupSpec(), backupSqlite(), findTool(), mongoConfig(), mysqlDefaults(), pgEnv(), restoreSpec() (+4 more)

### Community 83 - "package-platform.mjs"
Cohesion: 0.18
Nodes (11): bindingsDir, ext, nativeSource(), nodeApiDir, out, require, root, run() (+3 more)

### Community 85 - "extension/package.json"
Cohesion: 0.08
Nodes (24): bugs, url, categories, description, displayName, engines, vscode, galleryBanner (+16 more)

### Community 86 - "contributes"
Cohesion: 0.12
Nodes (17): contributes, commands, grammars, keybindings, languages, mcpServerDefinitionProviders, menus, notebooks (+9 more)

### Community 87 - "designer.ts"
Cohesion: 0.30
Nodes (12): DesignTable, HostToDesigner, cell(), check(), collect(), colRow(), csv(), el() (+4 more)

### Community 88 - "hydradb.test.ts"
Cohesion: 0.19
Nodes (10): assessCypher(), Risk, stripCypher(), cfg, port, hydradbDriver, parseLossless(), capabilities (+2 more)

### Community 89 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, noEmit, rootDir, types, extends, include, node (+4 more)

### Community 90 - "explain.ts"
Cohesion: 0.22
Nodes (13): sig(), explain(), num(), parseMysqlPlan(), parsePostgresPlan(), parseSqlitePlan(), parseTreePlan(), PgNode (+5 more)

### Community 91 - "editing.ts"
Cohesion: 0.10
Nodes (20): applyChanges(), ApplyOptions, ApplyResult, Change, chooseRowKey(), EditError, EditQueue, EditTarget (+12 more)

### Community 92 - "parse.ts"
Cohesion: 0.27
Nodes (12): asRow(), decodeStream(), detectDelimiter(), detectEncoding(), detectFormat(), openSource(), parseDelimited(), parseJsonArray() (+4 more)

### Community 93 - "mysql/src/index.ts"
Cohesion: 0.19
Nodes (10): colsOf(), Ctx, Field, kindOf(), SAFE_MAX, SAFE_MIN, toParam(), capabilities (+2 more)

### Community 94 - "oracle/src/index.ts"
Cohesion: 0.16
Nodes (13): connectString(), fetchTypeHandler(), isQuery(), isReadOnlySafe(), kindOf(), oracleDriver, run(), SAFE_MAX (+5 more)

### Community 95 - "engines.integration.test.mts"
Cohesion: 0.09
Nodes (37): chPort, esPort, mongoPort, neoPort, page(), profile(), run(), sig() (+29 more)

### Community 96 - "policy-engine.test.ts"
Cohesion: 0.12
Nodes (14): m(), AuditLog, AuditOptions, stripLiterals(), setup(), builtInPolicy, featureEnabled(), mergePolicies() (+6 more)

### Community 97 - "lib.test.ts"
Cohesion: 0.10
Nodes (26): formatValue(), DBEAVER_DRIVERS, dec(), fromJdbc(), ImportedConnection, parseConnectionUri(), parseDBeaver(), parseMyCnf() (+18 more)

### Community 98 - "resultsPanel.ts"
Cohesion: 0.18
Nodes (9): Shape, Cell, Col, HostToWebview, WebviewToHost, EXT, ResultsLocation, ResultsPanel (+1 more)

### Community 99 - "historyPanel.ts"
Cohesion: 0.15
Nodes (7): HistoryToHost, Favorite, Favorites, entry, History, HistoryEntry, openHistoryScreen()

### Community 100 - "site/package.json"
Cohesion: 0.17
Nodes (11): devDependencies, vitepress, name, private, scripts, build, dev, preview (+3 more)

### Community 101 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, noImplicitOverride, noUncheckedIndexedAccess, skipLibCheck, strict (+3 more)

### Community 102 - "rizomadb.editor.highlightStatement"
Cohesion: 0.50
Nodes (4): rizomadb.editor.highlightStatement, default, markdownDescription, type

### Community 103 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, esbuild, @types/pg, @types/vscode, @vscode/test-electron, @vscode/vsce, esbuild, @types/pg (+3 more)

### Community 104 - "rizomadb.environments"
Cohesion: 0.18
Nodes (11): properties, required, type, name, protection, rizomadb.environments, default, description (+3 more)

### Community 106 - "make-screenshot-data.mjs"
Cohesion: 0.20
Nodes (9): cols, conn, er, history, logos, people, plan, rows (+1 more)

### Community 107 - "admin/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 108 - "ai/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 109 - "core/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 110 - "data-tools/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 111 - "intelligence.test.ts"
Cohesion: 0.14
Nodes (10): FORMAT_DEFAULTS, FormatOptions, formatSql(), indent(), LANG, LetterCase, at(), fks (+2 more)

### Community 112 - "driver-api/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 113 - "cassandra/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 114 - "clickhouse/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 115 - "duckdb/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 116 - "dynamodb/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 117 - "elasticsearch/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 118 - "firestore/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 119 - "hydradb/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 120 - "influxdb3/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 121 - "influxdb/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 122 - "mongodb/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 123 - "mssql/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 124 - ".execute"
Cohesion: 0.19
Nodes (7): run(), guardConnection(), Connection, Transaction, freshDb(), freshSchema(), exec()

### Community 125 - "mysql/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 126 - "neo4j/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 127 - "oracle/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 128 - "postgres/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 129 - "redis/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 130 - "sqlite/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 131 - "trino/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 132 - "mcp/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 133 - "network/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 134 - "schema-tools/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 135 - "sql/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 136 - "license-audit.mjs"
Cohesion: 0.25
Nodes (6): ALLOWED, bad, raw, REVIEWED, rows, T

### Community 137 - "test-engines/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 138 - "dependencies"
Cohesion: 0.05
Nodes (41): dependencies, @rizomadb/admin, @rizomadb/ai, @rizomadb/data-tools, @rizomadb/driver-api, @rizomadb/driver-cassandra, @rizomadb/driver-clickhouse, @rizomadb/driver-duckdb (+33 more)

### Community 139 - "generate.ts"
Cohesion: 0.25
Nodes (5): D, GenColumn, generateRows(), GenOptions, rng()

### Community 140 - "scope.ts"
Cohesion: 0.24
Nodes (17): diagnose(), Diagnostic, lc(), analyzeContext(), CLAUSE_KW, collectRefs(), isIdent(), lower() (+9 more)

### Community 141 - "rizomadb.language"
Cohesion: 0.25
Nodes (8): rizomadb.language, default, description, enum, type, auto, en, es

### Community 142 - "rizomadb.results.location"
Cohesion: 0.25
Nodes (8): rizomadb.results.location, default, description, enum, type, beside, bottom, full

### Community 144 - "rizomadb.format.indentStyle"
Cohesion: 0.22
Nodes (9): rizomadb.format.indentStyle, default, enum, markdownDescription, scope, type, standard, tabularLeft (+1 more)

### Community 146 - "rizomadb.ai.provider"
Cohesion: 0.29
Nodes (7): rizomadb.ai.provider, default, enum, markdownDescription, type, anthropic, openai-compatible

### Community 147 - "rizomadb.format.logicalOperatorNewline"
Cohesion: 0.25
Nodes (8): rizomadb.format.logicalOperatorNewline, default, enum, markdownDescription, scope, type, after, before

### Community 149 - "rizomadb.format.expressionWidth"
Cohesion: 0.29
Nodes (7): rizomadb.format.expressionWidth, default, markdownDescription, maximum, minimum, scope, type

### Community 150 - "keywords"
Cohesion: 0.22
Nodes (9): keywords, client, database, mysql, postgres, query, redis, sql (+1 more)

### Community 151 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, package, test, test:e2e, typecheck

### Community 153 - "ExecuteRequest"
Cohesion: 0.50
Nodes (4): ExecuteRequest, makeClient(), makeClient(), makeClient()

### Community 156 - "bench/run.mjs"
Cohesion: 0.33
Nodes (4): big, cases, idx, t

### Community 157 - "activationEvents"
Cohesion: 0.40
Nodes (5): activationEvents, onLanguage:rizomadb-cypher, onLanguage:rizomadb-es, onLanguage:rizomadb-mongo, onLanguage:rizomadb-redis

### Community 158 - "rizomadb.catalog.teamFile"
Cohesion: 0.40
Nodes (5): rizomadb.catalog.teamFile, default, markdownDescription, scope, type

### Community 159 - "rizomadb.history.retentionDays"
Cohesion: 0.40
Nodes (5): rizomadb.history.retentionDays, default, markdownDescription, minimum, type

### Community 160 - "rizomadb.policy.team"
Cohesion: 0.40
Nodes (5): rizomadb.policy.team, default, markdownDescription, scope, type

### Community 161 - "rizomadb.query.maxRows"
Cohesion: 0.40
Nodes (5): rizomadb.query.maxRows, default, markdownDescription, minimum, type

### Community 162 - "rizomadb.query.pageSize"
Cohesion: 0.40
Nodes (5): rizomadb.query.pageSize, default, markdownDescription, minimum, type

### Community 163 - "properties"
Cohesion: 0.12
Nodes (16): properties, title, configuration, rizomadb.audit.enabled, rizomadb.query.keysetPaging, rizomadb.query.timeoutSeconds, default, markdownDescription (+8 more)

### Community 164 - "rizomadb.table.openRows"
Cohesion: 0.40
Nodes (5): rizomadb.table.openRows, default, markdownDescription, minimum, type

### Community 165 - "encryptedCatalog.ts"
Cohesion: 0.17
Nodes (12): KDF, key(), seal(), SealedCatalogError, profiles, unseal(), buildExport(), ImportResult (+4 more)

### Community 166 - "cassandra/src/index.ts"
Cohesion: 0.21
Nodes (11): cfg, port, assessCql(), stripCql(), cassandraDriver, kindOf(), nativeName(), toParam() (+3 more)

### Community 167 - "rizomadb.edit.withoutPrimaryKey"
Cohesion: 0.50
Nodes (4): rizomadb.edit.withoutPrimaryKey, default, markdownDescription, type

### Community 168 - "config.mts"
Cohesion: 0.40
Nodes (4): engineName, engines, enSidebar, esSidebar

### Community 169 - "rizomadb.format.linesBetweenQueries"
Cohesion: 0.29
Nodes (7): rizomadb.format.linesBetweenQueries, default, markdownDescription, maximum, minimum, scope, type

### Community 170 - "rizomadb.format.denseOperators"
Cohesion: 0.40
Nodes (5): rizomadb.format.denseOperators, default, markdownDescription, scope, type

### Community 171 - "rizomadb.format.newlineBeforeSemicolon"
Cohesion: 0.40
Nodes (5): rizomadb.format.newlineBeforeSemicolon, default, markdownDescription, scope, type

### Community 172 - "rizomadb.ai.enabled"
Cohesion: 0.50
Nodes (4): rizomadb.ai.enabled, default, markdownDescription, type

### Community 173 - "rizomadb.ai.endpoint"
Cohesion: 0.50
Nodes (4): rizomadb.ai.endpoint, default, markdownDescription, type

### Community 174 - "rizomadb.ai.model"
Cohesion: 0.50
Nodes (4): rizomadb.ai.model, default, markdownDescription, type

### Community 175 - "untrustedWorkspaces"
Cohesion: 0.50
Nodes (4): capabilities, untrustedWorkspaces, description, supported

### Community 176 - "rizomadb.ai.redactLiterals"
Cohesion: 0.50
Nodes (4): rizomadb.ai.redactLiterals, default, markdownDescription, type

### Community 177 - "Admin"
Cohesion: 0.30
Nodes (3): registerAdminCommands(), Admin, asTable()

### Community 178 - "rizomadb.audit.path"
Cohesion: 0.50
Nodes (4): rizomadb.audit.path, default, markdownDescription, type

### Community 179 - "Dialect"
Cohesion: 0.20
Nodes (6): Eng, engines, Dialect, alphabet, dialects, sqlish

### Community 180 - "MysqlConnection"
Cohesion: 0.31
Nodes (3): mapError(), MysqlConnection, run()

### Community 181 - "rizomadb.editor.codeLens"
Cohesion: 0.50
Nodes (4): rizomadb.editor.codeLens, default, markdownDescription, type

### Community 182 - "rizomadb.history.enabled"
Cohesion: 0.50
Nodes (4): rizomadb.history.enabled, default, markdownDescription, type

### Community 183 - "rizomadb.mcp.autoRegister"
Cohesion: 0.50
Nodes (4): rizomadb.mcp.autoRegister, default, markdownDescription, type

### Community 184 - "rizomadb.security.confirmDestructive"
Cohesion: 0.50
Nodes (4): rizomadb.security.confirmDestructive, default, markdownDescription, type

### Community 187 - "rizomadb.explorer.groupByFamily"
Cohesion: 0.50
Nodes (4): rizomadb.explorer.groupByFamily, default, description, type

### Community 189 - "editing.test.ts"
Cohesion: 0.33
Nodes (5): Engine, engines, run(), setup(), wanted

### Community 191 - "policy-paths.test.ts"
Cohesion: 0.38
Nodes (5): syncChanges(), prod(), q(), sig(), q()

### Community 192 - "tableProperties"
Cohesion: 0.53
Nodes (3): lc(), SQL_DIALECTS, tableProperties

### Community 194 - "readOnlyUser.integration.test.mts"
Cohesion: 0.13
Nodes (20): bq(), dq(), hasControl(), Case, cases, chPort, myPort, pgPort (+12 more)

### Community 195 - "sql/src/index.ts"
Cohesion: 0.33
Nodes (4): CompletionResult, Clause, CompletionContext, TableRef

### Community 196 - "Value"
Cohesion: 0.50
Nodes (5): Value, jsonable(), toValue(), bindOf(), normalize()

### Community 249 - "smoke-vsix-duckdb.mjs"
Cohesion: 0.33
Nodes (4): dir, timer, [vsix, expect = "ok"], worker

### Community 251 - "tidb.test.ts"
Cohesion: 0.36
Nodes (5): isReadOnlyStatement(), READ_START, stripSql(), base, port

### Community 260 - "take-screenshots.mjs"
Cohesion: 0.33
Nodes (5): base, head, run(), server, shot()

### Community 262 - "tr"
Cohesion: 0.14
Nodes (51): tr(), announce(), autosize(), beginEdit(), cellMenu(), chipNode(), columnsMenu(), deleteSelected() (+43 more)

### Community 263 - "rizomadb.connections.idleMinutes"
Cohesion: 0.40
Nodes (5): rizomadb.connections.idleMinutes, default, markdownDescription, minimum, type

### Community 265 - "mysql.test.ts"
Cohesion: 0.40
Nodes (3): mysqlDriver, base, port

### Community 273 - "gen-reference.mjs"
Cohesion: 0.21
Nodes (11): check, commands(), en, es, L, matrix(), md(), outputs (+3 more)

### Community 274 - "test-engines/src/index.ts"
Cohesion: 0.22
Nodes (5): available(), EngineId, engines, reachable(), TestEngine

### Community 293 - "rizomadb.edit.applyImmediately"
Cohesion: 0.50
Nodes (4): rizomadb.edit.applyImmediately, default, markdownDescription, type

### Community 297 - "mcpProvider.ts"
Cohesion: 0.38
Nodes (5): Api, envReferences(), registerMcpProvider(), registerMcpServerDefinitionProvider(), StdioDefinition

### Community 322 - "t"
Cohesion: 0.11
Nodes (29): GuideToHost, HostToGuide, bundle, BUNDLE_OF, effectiveLanguage(), format(), initI18n(), t() (+21 more)

### Community 337 - "rizomadb.security.prodReadOnlyByDefault"
Cohesion: 0.50
Nodes (4): rizomadb.security.prodReadOnlyByDefault, default, markdownDescription, type

### Community 360 - "rizomadb.audit.includeValues"
Cohesion: 0.50
Nodes (4): rizomadb.audit.includeValues, default, markdownDescription, type

## Knowledge Gaps
- **1390 isolated node(s):** `vscode`, `assert`, `name`, `displayName`, `description` (+1385 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Value` connect `Value` to `lib.test.ts`, `export.ts`, `hydradb/src/index.ts`, `types.ts`, `mongodb/src/index.ts`, `cassandra/src/index.ts`, `influxdb3/src/index.ts`, `sqlite/src/index.ts`, `compare.ts`, `neo4j/src/index.ts`, `PendingEdits`, `trino/src/index.ts`, `server.ts`, `ExecuteRequest`, `mssql/src/index.ts`, `engines.integration.test.mts`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `k()` connect `k` to `lib.test.ts`, `completion.ts`, `mongodb/src/index.ts`, `nosqlCommands.ts`, `tr`, `ConnectionManager`, `influxdb3/src/index.ts`, `firestore/src/index.ts`, `jdbcUrl.ts`, `dynamodb/src/index.ts`, `webview/er.ts`, `elasticsearch/src/index.ts`, `designer.ts`, `catalog.ts`, `connect.ts`, `engines.integration.test.mts`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `mongodb` connect `mongodb/src/index.ts` to `keywords`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `vscode`, `assert`, `name` to the rest of the system?**
  _1390 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.022424242424242423 - nodes in this community are weakly interconnected._
- **Should `completion.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1402116402116402 - nodes in this community are weakly interconnected._
- **Should `diff.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07497565725413827 - nodes in this community are weakly interconnected._
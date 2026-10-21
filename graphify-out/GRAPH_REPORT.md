# Graph Report - .  (2026-10-21)

## Corpus Check
- 469 files · ~223,152 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3342 nodes · 5440 edges · 248 communities (207 shown, 41 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 218

## God Nodes (most connected - your core abstractions)
1. `activate()` - 61 edges
2. `t()` - 51 edges
3. `tr()` - 49 edges
4. `ConnectionManager` - 42 edges
5. `openConnectionScreen()` - 24 edges
6. `onMessage()` - 24 edges
7. `iconButton()` - 24 edges
8. `vscode` - 24 edges
9. `friendly()` - 23 edges
10. `Value` - 23 edges

## Surprising Connections (you probably didn't know these)
- `analyzeDocuments()` --indirect_call--> `x()`  [INFERRED]
  apps/extension/src/lib/mongoTools.ts → packages/admin/src/admin.test.ts
- `analysisMarkdown()` --references--> `L`  [EXTRACTED]
  apps/extension/src/lib/mongoTools.ts → scripts/gen-reference.mjs
- `mergePolicies()` --indirect_call--> `m()`  [INFERRED]
  packages/core/src/effective-policy.ts → apps/extension/src/lib/schemaModel.test.ts
- `matrix()` --references--> `Admin`  [EXTRACTED]
  scripts/gen-reference.mjs → packages/admin/src/admin.ts
- `formatValue()` --references--> `Value`  [EXTRACTED]
  apps/extension/src/lib/format.ts → packages/driver-api/src/types.ts

## Import Cycles
- None detected.

## Communities (248 total, 41 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (87): api, applyFilter(), body, btnApply, btnColumns, btnCopy, btnDelete, btnDensity (+79 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (63): complete(), CompletionItem, CompletionKind, CompletionResult, lc(), needsQuote(), ord(), quoteIfNeeded() (+55 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (63): ColumnOp, columnStatements(), lc(), addFk(), assertFragment(), assertIdentifier(), columnDef(), createIndex() (+55 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (41): Assessment, assessMongo(), DESTRUCTIVE, hasOut(), isEmpty(), READ_COLLECTION, READ_COMMANDS, READ_DB (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (35): GuideToHost, HistoryToHost, effectiveLanguage(), format(), initI18n(), spanish, t(), UiLanguage (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): asValue(), col(), mapError(), pairs(), RedisConnection, redisDriver, row(), Shape (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (40): checkHostKey(), createHmacless(), entriesFor(), fingerprint(), formatEntry(), glob(), HostKeyDecision, HostKeyEntry (+32 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (15): activate(), Memento, OpenTunnel, takeProxy(), takeSsh(), fieldText(), loadModel(), buildProfile() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (44): tr(), announce(), autosize(), beginEdit(), buildFilterBar(), cellMenu(), columnsMenu(), deleteSelected() (+36 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (27): assessFirestore(), Command, ConsoleSyntaxError, isStr(), Op, opName(), OPS, parseCommand() (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (41): axe-core, eslint, @eslint/js, @fontsource/inter, opentype.js, devDependencies, axe-core, eslint (+33 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (20): drivers, iters, Target, targets, ConnectResult, NextResult, Request, Response (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (40): dependencies, @rizomadb/driver-api, zod, devDependencies, fast-check, mongodb, mysql2, oracledb (+32 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (26): cfg, port, AttributeValue, AwsError, Client, DynamoConnection, dynamodbDriver, fromAttr() (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (29): @clickhouse/client, dependencies, @clickhouse/client, @rizomadb/driver-api, exports, ./meta, @rizomadb/driver-api, license (+21 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (22): assessCypher(), Risk, stripCypher(), Client, CypherError, decode(), kindOf(), mapError() (+14 more)

### Community 16 - "Community 16"
Cohesion: 0.05
Nodes (38): bin, rizomadb-mcp, dependencies, @rizomadb/core, @rizomadb/data-tools, @rizomadb/driver-api, @rizomadb/driver-mssql, @rizomadb/driver-mysql (+30 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (37): dependencies, mysql2, oracledb, pg, @rizomadb/driver-api, @rizomadb/driver-mssql, @rizomadb/driver-mysql, @rizomadb/driver-oracle (+29 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (19): CsvReader, RFC-4180, assessFlux(), stripFlux(), Client, convert(), csvToEvents(), HttpError (+11 more)

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (36): dependencies, @rizomadb/driver-api, sql-formatter, devDependencies, fast-check, mysql2, oracledb, pg (+28 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (30): HostToGuide, esc(), iconBtn(), iconSvg(), api, done, go(), ic() (+22 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (21): assessConsole(), ConsoleRequest, ConsoleSyntaxError, parseConsole(), Risk, stripJsonComments(), bsonish(), Client (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (18): base, port, kindOf(), mapError(), PgConnection, postgresDriver, run(), Runner (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (21): base(), Client, convert(), HttpError, kindOf(), literal(), makeClient(), mapError() (+13 more)

### Community 24 - "Community 24"
Cohesion: 0.10
Nodes (22): main(), loaders, loadMcpConfig(), Mask, McpConfig, formatValue(), checkAgentQuery(), defaultRule() (+14 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (20): ConnectToHost, Engine, EngineFamily, ENGINES, FAMILY_ORDER, contrast(), lum(), ENGINE_LOGOS (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (15): cfg(), makeRegistry(), DriverRegistry, TunnelFactory, formatValue(), ChangeLabels, describeChanges(), EN (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (22): fks, schema, servers, AiConfig, AiDeclinedError, AiDisabledError, Answer, extractSql() (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (23): ConnectForm, HostToConnect, Shape, short, Cell, Col, Conn, conns (+15 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (26): dependencies, @rizomadb/core, @rizomadb/driver-api, devDependencies, fast-check, mongodb, @rizomadb/driver-postgres, @rizomadb/driver-sqlite (+18 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (22): m(), setup(), builtInPolicy, decideEffective(), EffectiveDecision, EnvRule, featureEnabled(), inter() (+14 more)

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (13): CatalogProfile, ConnectionManager, SshSettings, DIALECT_OF, SchemaCache, Deps, ENGINES, Deps (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (22): C, files, font, glyph(), horizontal(), lum(), markMono, markTile (+14 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (19): DBEAVER_DRIVERS, dec(), ImportedConnection, parseConnectionUri(), parseDBeaver(), parseMyCnf(), parsePgpass(), parseSqlTools() (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (18): csvCell(), decrypt(), ExportFormat, ExportOptions, exportResult(), hex(), jsonReplacer(), require_decipher() (+10 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (13): convert(), DuckConnection, duckdbDriver, isReadOnlySafe(), kindOf(), mapError(), run(), SAFE_MAX (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.16
Nodes (17): commandAt(), cypherStatementAt(), isQueryLanguage(), QUERY_LANGUAGES, AnalysisLabels, analysisMarkdown(), analyzeDocuments(), EN (+9 more)

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (16): batchLimits(), ConversionError, convertCell(), convertNonString(), ConvertOptions, DEFAULT_FALSE, DEFAULT_TRUE, ImportMapping (+8 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (13): cfg, port, assessCql(), stripCql(), CassandraConnection, cassandraDriver, kindOf(), mapError() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.09
Nodes (22): dependencies, pg, pg-cursor, @rizomadb/driver-api, devDependencies, @types/pg, exports, ./meta (+14 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (19): HostToSettings, Item, fill(), brandMark(), el(), fill(), Group, groups (+11 more)

### Community 41 - "Community 41"
Cohesion: 0.09
Nodes (21): ioredis, dependencies, ioredis, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta (+13 more)

### Community 42 - "Community 42"
Cohesion: 0.16
Nodes (11): ConnectionProfile, Environment, parseProfile(), redactObject(), redactString(), expandVariables(), MemorySecretStore, resolveConfig() (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.16
Nodes (16): applyChanges(), ApplyOptions, ApplyResult, Change, EditError, EditTarget, generate(), GeneratedStatement (+8 more)

### Community 44 - "Community 44"
Cohesion: 0.16
Nodes (17): backupSqlite(), applySync(), ApplySyncOptions, canon(), CompareOptions, DataDiff, diffTables(), literal() (+9 more)

### Community 45 - "Community 45"
Cohesion: 0.09
Nodes (21): dependencies, mongodb, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, ./parser (+13 more)

### Community 46 - "Community 46"
Cohesion: 0.10
Nodes (20): cassandra-driver, dependencies, cassandra-driver, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta (+12 more)

### Community 47 - "Community 47"
Cohesion: 0.15
Nodes (17): Value, jsonable(), toValue(), bindOf(), fetchTypeHandler(), isQuery(), isReadOnlySafe(), kindOf() (+9 more)

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (12): HttpError, Influx3Connection, kindOfValue(), mapError(), orderColumns(), paramValue(), parse(), readAll() (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.10
Nodes (20): dependencies, mysql2, @rizomadb/driver-api, devDependencies, pg, exports, ./meta, mysql2 (+12 more)

### Community 50 - "Community 50"
Cohesion: 0.10
Nodes (20): dependencies, oracledb, @rizomadb/driver-api, devDependencies, @types/oracledb, exports, ./meta, oracledb (+12 more)

### Community 51 - "Community 51"
Cohesion: 0.17
Nodes (14): DesignerToHost, DesignTable, ColumnAction, DEFAULT_TYPE, runColumnAction(), openDesigner(), toTable(), TRANSACTIONAL_DDL (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (18): HostToHistory, api, chips, clear, conn, count, field, Item (+10 more)

### Community 53 - "Community 53"
Cohesion: 0.12
Nodes (12): cards, Def, Msg, series, el(), fmt(), isMsg(), isNode() (+4 more)

### Community 54 - "Community 54"
Cohesion: 0.19
Nodes (14): sig(), exec(), explain(), num(), parseMysqlPlan(), parsePostgresPlan(), parseSqlitePlan(), parseTreePlan() (+6 more)

### Community 55 - "Community 55"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 58 - "Community 58"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 59 - "Community 59"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 60 - "Community 60"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 61 - "Community 61"
Cohesion: 0.16
Nodes (15): ColumnMetaData, isReadOnlySafe(), Item, kindOf(), mapError(), mssqlDriver, normalize(), param() (+7 more)

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, devDependencies, fast-check, exports, ./meta, fast-check, @rizomadb/driver-api (+10 more)

### Community 64 - "Community 64"
Cohesion: 0.11
Nodes (18): dependencies, @rizomadb/driver-api, @rizomadb/sql, devDependencies, @rizomadb/test-engines, @rizomadb/driver-api, @rizomadb/sql, @rizomadb/test-engines (+10 more)

### Community 65 - "Community 65"
Cohesion: 0.24
Nodes (14): EngineLogo, LogoShape, esc(), hasGradient(), logoDataUri(), logoSvg(), node(), adaptHex() (+6 more)

### Community 66 - "Community 66"
Cohesion: 0.11
Nodes (17): @duckdb/node-api, dependencies, @duckdb/node-api, @rizomadb/driver-api, exports, ./meta, @rizomadb/driver-api, license (+9 more)

### Community 67 - "Community 67"
Cohesion: 0.16
Nodes (11): MetricSampler, snapshotToRecord(), Table, priv(), setup(), sig(), x(), Engine (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (16): Capabilities, ColumnDef, ColumnInfo, DriverContext, EditTargetRef, EngineFamily, ForeignKey, IndexInfo (+8 more)

### Community 69 - "Community 69"
Cohesion: 0.16
Nodes (11): Cell, decode(), HydraConnection, HydraError, kindOf(), makeClient(), mapError(), Opts (+3 more)

### Community 70 - "Community 70"
Cohesion: 0.11
Nodes (17): dependencies, @rizomadb/driver-api, tedious, exports, ./meta, @rizomadb/driver-api, tedious, license (+9 more)

### Community 71 - "Community 71"
Cohesion: 0.12
Nodes (16): dependencies, @rizomadb/driver-api, devDependencies, @rizomadb/test-engines, @rizomadb/driver-api, @rizomadb/test-engines, license, main (+8 more)

### Community 72 - "Community 72"
Cohesion: 0.12
Nodes (16): dependencies, ssh2, devDependencies, @types/ssh2, license, main, name, scripts (+8 more)

### Community 73 - "Community 73"
Cohesion: 0.27
Nodes (13): splitStatements(), Statement, statementAt(), blockRanges(), cypherRanges(), lineEnd(), lineOffsets(), redisRanges() (+5 more)

### Community 74 - "Community 74"
Cohesion: 0.12
Nodes (15): exports, ./conformance, vitest, license, main, name, peerDependencies, vitest (+7 more)

### Community 75 - "Community 75"
Cohesion: 0.12
Nodes (15): dependencies, @rizomadb/driver-api, exports, ./meta, @rizomadb/driver-api, license, main, name (+7 more)

### Community 76 - "Community 76"
Cohesion: 0.14
Nodes (6): EditQueue, Engine, engines, run(), setup(), wanted

### Community 77 - "Community 77"
Cohesion: 0.18
Nodes (9): ConformanceOptions, ctx, engineUp(), reachable(), runConformance(), DriverError, DriverErrorKind, ResolvedConnectionConfig (+1 more)

### Community 78 - "Community 78"
Cohesion: 0.15
Nodes (14): ^build, dist/**, RZ_*, .vitepress/dist/**, dependsOn, outputs, globalPassThroughEnv, $schema (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.14
Nodes (11): ATTRS, gil(), logos, oracle, out, parse(), req, si (+3 more)

### Community 80 - "Community 80"
Cohesion: 0.30
Nodes (3): registerAdminCommands(), Admin, asTable()

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (13): dependencies, @rizomadb/core, @rizomadb/core, license, main, name, scripts, build (+5 more)

### Community 82 - "Community 82"
Cohesion: 0.26
Nodes (11): BackupEngine, backupSpec(), findTool(), mongoConfig(), mysqlDefaults(), pgEnv(), restoreSpec(), runTool() (+3 more)

### Community 83 - "Community 83"
Cohesion: 0.19
Nodes (10): assessCypher(), Risk, stripCypher(), cfg, port, hydradbDriver, parseLossless(), capabilities (+2 more)

### Community 84 - "Community 84"
Cohesion: 0.14
Nodes (10): audit, conns, hs, minutes, policy, rs, samples, t0 (+2 more)

### Community 85 - "Community 85"
Cohesion: 0.15
Nodes (12): description, displayName, engines, vscode, icon, l10n, license, main (+4 more)

### Community 86 - "Community 86"
Cohesion: 0.15
Nodes (13): contributes, commands, grammars, keybindings, languages, mcpServerDefinitionProviders, notebooks, views (+5 more)

### Community 87 - "Community 87"
Cohesion: 0.35
Nodes (11): HostToDesigner, cell(), check(), collect(), colRow(), csv(), el(), fkRow() (+3 more)

### Community 88 - "Community 88"
Cohesion: 0.22
Nodes (8): CatalogFile, CatalogResult, findSecrets(), loadCatalog(), FAIL_CLOSED, LoadedPolicy, loadPolicy(), PolicySources

### Community 89 - "Community 89"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, noEmit, rootDir, types, extends, include, node (+4 more)

### Community 90 - "Community 90"
Cohesion: 0.23
Nodes (5): guardConnection(), Connection, Transaction, freshDb(), freshSchema()

### Community 91 - "Community 91"
Cohesion: 0.17
Nodes (4): PendingEdits, same(), rows, target

### Community 92 - "Community 92"
Cohesion: 0.27
Nodes (12): asRow(), decodeStream(), detectDelimiter(), detectEncoding(), detectFormat(), openSource(), parseDelimited(), parseJsonArray() (+4 more)

### Community 93 - "Community 93"
Cohesion: 0.19
Nodes (10): colsOf(), Ctx, Field, kindOf(), SAFE_MAX, SAFE_MIN, toParam(), capabilities (+2 more)

### Community 94 - "Community 94"
Cohesion: 0.21
Nodes (11): check, commands(), en, es, L, matrix(), md(), outputs (+3 more)

### Community 95 - "Community 95"
Cohesion: 0.30
Nodes (10): balanced(), buildTableQuery(), FilterError, FilterKind, filterKindOf(), fragment(), SQL_DRIVERS, TableQueryInput (+2 more)

### Community 96 - "Community 96"
Cohesion: 0.18
Nodes (8): Col, draw(), Edge, mk(), Msg, Node, svg, vscode

### Community 97 - "Community 97"
Cohesion: 0.23
Nodes (9): assertName(), grantStatement(), lit(), mssql, mysql, oracle, postgres, PRIVS (+1 more)

### Community 98 - "Community 98"
Cohesion: 0.27
Nodes (4): AuditEntry, AuditLog, AuditOptions, stripLiterals()

### Community 99 - "Community 99"
Cohesion: 0.24
Nodes (10): EffectivePolicy, statementKind, GuardContext, Assessment, assessStatement(), decide(), defaultPolicy, Policy (+2 more)

### Community 100 - "Community 100"
Cohesion: 0.17
Nodes (11): devDependencies, vitepress, name, private, scripts, build, dev, preview (+3 more)

### Community 101 - "Community 101"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, noImplicitOverride, noUncheckedIndexedAccess, skipLibCheck, strict (+3 more)

### Community 102 - "Community 102"
Cohesion: 0.18
Nodes (11): properties, title, configuration, rizomadb.editor.codeLens, rizomadb.security.prodReadOnlyByDefault, default, markdownDescription, type (+3 more)

### Community 103 - "Community 103"
Cohesion: 0.18
Nodes (11): devDependencies, esbuild, @types/pg, @types/vscode, @vscode/test-electron, @vscode/vsce, esbuild, @types/pg (+3 more)

### Community 104 - "Community 104"
Cohesion: 0.18
Nodes (11): properties, required, type, name, protection, rizomadb.environments, default, description (+3 more)

### Community 106 - "Community 106"
Cohesion: 0.36
Nodes (6): fake(), page(), RunEvent, RunOptions, RunOutcome, runStatement()

### Community 107 - "Community 107"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 108 - "Community 108"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 109 - "Community 109"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 110 - "Community 110"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 111 - "Community 111"
Cohesion: 0.20
Nodes (6): ExecuteRequest, ResultEvent, ConnectionLoss, makeClient(), makeClient(), makeClient()

### Community 112 - "Community 112"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 113 - "Community 113"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 114 - "Community 114"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 115 - "Community 115"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 116 - "Community 116"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 117 - "Community 117"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 118 - "Community 118"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 119 - "Community 119"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 120 - "Community 120"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 121 - "Community 121"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 122 - "Community 122"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 123 - "Community 123"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 124 - "Community 124"
Cohesion: 0.31
Nodes (3): mapError(), MysqlConnection, run()

### Community 125 - "Community 125"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 126 - "Community 126"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 127 - "Community 127"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 128 - "Community 128"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 129 - "Community 129"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 130 - "Community 130"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 131 - "Community 131"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 132 - "Community 132"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 133 - "Community 133"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 134 - "Community 134"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 135 - "Community 135"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 136 - "Community 136"
Cohesion: 0.22
Nodes (5): available(), EngineId, engines, reachable(), TestEngine

### Community 137 - "Community 137"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, exclude, extends, include, src, src/**/*.test.ts (+1 more)

### Community 138 - "Community 138"
Cohesion: 0.22
Nodes (9): dependencies, @rizomadb/driver-mssql, @rizomadb/driver-neo4j, @rizomadb/driver-oracle, @rizomadb/network, @rizomadb/driver-mssql, @rizomadb/driver-oracle, @rizomadb/driver-neo4j (+1 more)

### Community 139 - "Community 139"
Cohesion: 0.25
Nodes (5): D, GenColumn, generateRows(), GenOptions, rng()

### Community 141 - "Community 141"
Cohesion: 0.25
Nodes (8): rizomadb.language, default, description, enum, type, auto, en, es

### Community 142 - "Community 142"
Cohesion: 0.25
Nodes (8): rizomadb.results.location, default, description, enum, type, beside, bottom, full

### Community 145 - "Community 145"
Cohesion: 0.36
Nodes (5): isReadOnlyStatement(), READ_START, stripSql(), base, port

### Community 146 - "Community 146"
Cohesion: 0.29
Nodes (7): rizomadb.ai.provider, default, enum, markdownDescription, type, anthropic, openai-compatible

### Community 147 - "Community 147"
Cohesion: 0.38
Nodes (5): Api, envReferences(), registerMcpProvider(), registerMcpServerDefinitionProvider(), StdioDefinition

### Community 149 - "Community 149"
Cohesion: 0.29
Nodes (6): ALLOWED, bad, md, raw, REVIEWED, rows

### Community 150 - "Community 150"
Cohesion: 0.33
Nodes (6): keywords, client, database, postgres, sql, sqlite

### Community 151 - "Community 151"
Cohesion: 0.33
Nodes (6): scripts, build, package, test, test:e2e, typecheck

### Community 153 - "Community 153"
Cohesion: 0.53
Nodes (3): lc(), SQL_DIALECTS, tableProperties

### Community 156 - "Community 156"
Cohesion: 0.33
Nodes (4): big, cases, idx, t

### Community 157 - "Community 157"
Cohesion: 0.40
Nodes (5): activationEvents, onLanguage:rizomadb-cypher, onLanguage:rizomadb-es, onLanguage:rizomadb-mongo, onLanguage:rizomadb-redis

### Community 158 - "Community 158"
Cohesion: 0.40
Nodes (5): rizomadb.catalog.teamFile, default, markdownDescription, scope, type

### Community 159 - "Community 159"
Cohesion: 0.40
Nodes (5): rizomadb.history.retentionDays, default, markdownDescription, minimum, type

### Community 160 - "Community 160"
Cohesion: 0.40
Nodes (5): rizomadb.policy.team, default, markdownDescription, scope, type

### Community 161 - "Community 161"
Cohesion: 0.40
Nodes (5): rizomadb.query.maxRows, default, markdownDescription, minimum, type

### Community 162 - "Community 162"
Cohesion: 0.40
Nodes (5): rizomadb.query.pageSize, default, markdownDescription, minimum, type

### Community 163 - "Community 163"
Cohesion: 0.40
Nodes (5): rizomadb.query.timeoutSeconds, default, markdownDescription, minimum, type

### Community 164 - "Community 164"
Cohesion: 0.40
Nodes (5): rizomadb.table.openRows, default, markdownDescription, minimum, type

### Community 166 - "Community 166"
Cohesion: 0.40
Nodes (3): influxdb3Driver, cfg, port

### Community 167 - "Community 167"
Cohesion: 0.40
Nodes (3): mysqlDriver, base, port

### Community 168 - "Community 168"
Cohesion: 0.40
Nodes (4): engineName, engines, enSidebar, esSidebar

### Community 170 - "Community 170"
Cohesion: 0.50
Nodes (4): capabilities, untrustedWorkspaces, description, supported

### Community 171 - "Community 171"
Cohesion: 0.50
Nodes (4): menus, editor/title, view/item/context, view/title

### Community 172 - "Community 172"
Cohesion: 0.50
Nodes (4): rizomadb.ai.enabled, default, markdownDescription, type

### Community 173 - "Community 173"
Cohesion: 0.50
Nodes (4): rizomadb.ai.endpoint, default, markdownDescription, type

### Community 174 - "Community 174"
Cohesion: 0.50
Nodes (4): rizomadb.ai.model, default, markdownDescription, type

### Community 175 - "Community 175"
Cohesion: 0.50
Nodes (4): rizomadb.ai.redactLiterals, default, markdownDescription, type

### Community 176 - "Community 176"
Cohesion: 0.50
Nodes (4): rizomadb.audit.enabled, default, markdownDescription, type

### Community 177 - "Community 177"
Cohesion: 0.50
Nodes (4): rizomadb.audit.includeValues, default, markdownDescription, type

### Community 178 - "Community 178"
Cohesion: 0.50
Nodes (4): rizomadb.audit.path, default, markdownDescription, type

### Community 179 - "Community 179"
Cohesion: 0.50
Nodes (4): rizomadb.edit.applyImmediately, default, markdownDescription, type

### Community 180 - "Community 180"
Cohesion: 0.50
Nodes (4): rizomadb.editor.highlightStatement, default, markdownDescription, type

### Community 181 - "Community 181"
Cohesion: 0.50
Nodes (4): rizomadb.explorer.groupByFamily, default, description, type

### Community 182 - "Community 182"
Cohesion: 0.50
Nodes (4): rizomadb.history.enabled, default, markdownDescription, type

### Community 183 - "Community 183"
Cohesion: 0.50
Nodes (4): rizomadb.mcp.autoRegister, default, markdownDescription, type

### Community 184 - "Community 184"
Cohesion: 0.50
Nodes (4): rizomadb.security.confirmDestructive, default, markdownDescription, type

### Community 186 - "Community 186"
Cohesion: 0.67
Nodes (3): categories, Data Science, Other

### Community 187 - "Community 187"
Cohesion: 0.67
Nodes (3): galleryBanner, color, theme

## Knowledge Gaps
- **1238 isolated node(s):** `here`, `base`, `vscode`, `assert`, `common` (+1233 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Value` connect `Community 47` to `Community 34`, `Community 3`, `Community 68`, `Community 69`, `Community 38`, `Community 5`, `Community 44`, `Community 111`, `Community 48`, `Community 15`, `Community 23`, `Community 24`, `Community 26`, `Community 91`, `Community 61`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `formatValue()` connect `Community 26` to `Community 33`, `Community 36`, `Community 7`, `Community 47`, `Community 31`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `x()` connect `Community 67` to `Community 1`, `Community 2`, `Community 36`, `Community 54`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `here`, `base`, `vscode` to the rest of the system?**
  _1238 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02477017364657814 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05499316005471956 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07497565725413827 - nodes in this community are weakly interconnected._
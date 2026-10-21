export type Engine = "postgres" | "mysql" | "mssql" | "oracle";

export interface MetricDef { name: string; label: string; kind: "gauge" | "counter" | "ratio"; /** for ratio: numerator and denominator counter names */ of?: [string, string] }

export interface Provider {
  engine: Engine;
  sessions: string;
  locks: string;
  slow(limit: number): string;
  tableStats: string;
  unusedIndexes: string;
  variables: string;
  roles: string;
  privileges(role: string): string;
  kill(id: string, hard: boolean): string[];
  setVariable(name: string, value: string): { statements: string[]; note?: string };
  metrics: string;
  metricDefs: MetricDef[];
}

/** SQL string literal. All user-supplied text reaches SQL only through this or a validated identifier pattern. */
export const lit = (s: string) => `'${s.replaceAll("'", "''")}'`;
export const assertName = (s: string, what = "name") => { if (!/^[A-Za-z_][A-Za-z0-9_.$#@-]{0,127}$/.test(s)) throw new Error(`Invalid ${what}: ${JSON.stringify(s)}`); return s; };
const assertId = (s: string, re: RegExp, what: string) => { if (!re.test(s)) throw new Error(`Invalid ${what}: ${JSON.stringify(s)}`); return s; };
const num = (n: number) => { if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error("Invalid limit"); return n; };
const value = (v: string) => (/^-?\d+(\.\d+)?$/.test(v) ? v : lit(v));

const SYSTEM_MY = "('mysql','performance_schema','sys','information_schema')";

export const postgres: Provider = {
  engine: "postgres",
  sessions: `SELECT pid::text AS id, usename AS "user", datname AS "database", state, wait_event AS wait, left(query, 2000) AS query, backend_start AS started, (pid = pg_backend_pid()) AS is_me FROM pg_stat_activity WHERE backend_type = 'client backend' ORDER BY query_start NULLS LAST`,
  locks: `SELECT b.pid::text AS blocked_id, b.usename AS blocked_user, left(b.query, 500) AS blocked_query, k.pid::text AS blocking_id, k.usename AS blocking_user, left(k.query, 500) AS blocking_query, round(extract(epoch FROM now() - b.query_start)::numeric, 1) AS wait_seconds FROM pg_stat_activity b CROSS JOIN LATERAL unnest(pg_blocking_pids(b.pid)) AS bp(pid) JOIN pg_stat_activity k ON k.pid = bp.pid`,
  slow: (n) => `SELECT left(query, 2000) AS query, calls, round(total_exec_time::numeric, 2) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms, rows FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT ${num(n)}`,
  tableStats: `SELECT schemaname AS "schema", relname AS "table", n_live_tup AS rows_est, n_dead_tup AS dead_rows, pg_total_relation_size(relid) AS size_bytes, seq_scan, idx_scan, last_autovacuum FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC`,
  unusedIndexes: `SELECT s.schemaname AS "schema", s.relname AS "table", s.indexrelname AS "index", pg_relation_size(s.indexrelid) AS size_bytes FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary ORDER BY pg_relation_size(s.indexrelid) DESC`,
  variables: `SELECT name, setting AS value, unit, short_desc AS description, context FROM pg_settings ORDER BY name`,
  roles: `SELECT rolname AS name, rolsuper AS superuser, rolcreatedb AS createdb, rolcreaterole AS createrole, rolcanlogin AS can_login, rolreplication AS replication FROM pg_roles WHERE rolname NOT LIKE 'pg\\_%' ORDER BY 1`,
  privileges: (role) => `SELECT n.nspname AS "schema", c.relname AS "object", p.priv AS privilege FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES')) p(priv) WHERE c.relkind IN ('r', 'v', 'p', 'm') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_toast%' AND has_table_privilege(${lit(role)}, c.oid, p.priv) ORDER BY 1, 2, 3`,
  kill: (id, hard) => [`SELECT ${hard ? "pg_terminate_backend" : "pg_cancel_backend"}(${assertId(id, /^\d+$/, "session id")})`],
  setVariable: (name, v) => ({ statements: [`ALTER SYSTEM SET ${assertName(name, "setting")} = ${lit(v)}`, "SELECT pg_reload_conf()"], note: "Persisted in postgresql.auto.conf; settings with context 'postmaster' need a restart." }),
  metrics: `SELECT (SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'client backend') AS connections, xact_commit + xact_rollback AS transactions, blks_hit AS cache_hits, blks_read AS cache_reads, tup_returned AS rows_read, deadlocks FROM pg_stat_database WHERE datname = current_database()`,
  metricDefs: [{ name: "connections", label: "Connections", kind: "gauge" }, { name: "transactions", label: "Transactions/s", kind: "counter" }, { name: "cache_hits", label: "Cache hits/s", kind: "counter" }, { name: "cache_hit_ratio", label: "Cache hit ratio", kind: "ratio", of: ["cache_hits", "cache_reads"] }, { name: "rows_read", label: "Rows read/s", kind: "counter" }],
};

export const mysql: Provider = {
  engine: "mysql",
  sessions: `SELECT ID AS id, USER AS \`user\`, DB AS \`database\`, COMMAND AS state, TIME AS wait, LEFT(INFO, 2000) AS query, (ID = CONNECTION_ID()) AS is_me FROM information_schema.PROCESSLIST ORDER BY TIME DESC`,
  locks: `SELECT rt.trx_mysql_thread_id AS blocked_id, rp.USER AS blocked_user, LEFT(rt.trx_query, 500) AS blocked_query, bt.trx_mysql_thread_id AS blocking_id, bp.USER AS blocking_user, LEFT(bt.trx_query, 500) AS blocking_query, TIMESTAMPDIFF(SECOND, rt.trx_wait_started, NOW()) AS wait_seconds FROM performance_schema.data_lock_waits w JOIN information_schema.innodb_trx rt ON rt.trx_id = w.REQUESTING_ENGINE_TRANSACTION_ID JOIN information_schema.innodb_trx bt ON bt.trx_id = w.BLOCKING_ENGINE_TRANSACTION_ID LEFT JOIN information_schema.PROCESSLIST rp ON rp.ID = rt.trx_mysql_thread_id LEFT JOIN information_schema.PROCESSLIST bp ON bp.ID = bt.trx_mysql_thread_id`,
  slow: (n) => `SELECT DIGEST_TEXT AS query, COUNT_STAR AS calls, ROUND(SUM_TIMER_WAIT / 1000000000, 2) AS total_ms, ROUND(AVG_TIMER_WAIT / 1000000000, 2) AS mean_ms, SUM_ROWS_SENT AS \`rows\` FROM performance_schema.events_statements_summary_by_digest WHERE SCHEMA_NAME IS NOT NULL ORDER BY SUM_TIMER_WAIT DESC LIMIT ${num(n)}`,
  tableStats: `SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS \`table\`, TABLE_ROWS AS rows_est, DATA_LENGTH + INDEX_LENGTH AS size_bytes, DATA_FREE AS free_bytes FROM information_schema.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ${SYSTEM_MY} ORDER BY DATA_LENGTH + INDEX_LENGTH DESC`,
  unusedIndexes: `SELECT object_schema AS \`schema\`, object_name AS \`table\`, index_name AS \`index\` FROM performance_schema.table_io_waits_summary_by_index_usage WHERE index_name IS NOT NULL AND index_name <> 'PRIMARY' AND count_star = 0 AND object_schema NOT IN ${SYSTEM_MY} ORDER BY 1, 2, 3`,
  variables: `SELECT VARIABLE_NAME AS name, VARIABLE_VALUE AS value FROM performance_schema.global_variables ORDER BY 1`,
  roles: `SELECT User AS name, Host AS host, account_locked AS locked, password_expired AS password_expired FROM mysql.user ORDER BY 1, 2`,
  privileges: (role) => { const [u, h = "%"] = role.split("@"); return `SHOW GRANTS FOR ${lit(u!)}@${lit(h)}`; },
  kill: (id, hard) => [`KILL ${hard ? "CONNECTION" : "QUERY"} ${assertId(id, /^\d+$/, "session id")}`],
  setVariable: (name, v) => ({ statements: [`SET GLOBAL ${assertName(name, "variable")} = ${value(v)}`], note: "Applies to new connections until the server restarts; persist it in my.cnf or use SET PERSIST." }),
  metrics: `SELECT MAX(CASE WHEN VARIABLE_NAME = 'Threads_connected' THEN VARIABLE_VALUE END) + 0 AS connections, MAX(CASE WHEN VARIABLE_NAME = 'Questions' THEN VARIABLE_VALUE END) + 0 AS queries, MAX(CASE WHEN VARIABLE_NAME = 'Innodb_buffer_pool_read_requests' THEN VARIABLE_VALUE END) + 0 AS cache_reads_total, MAX(CASE WHEN VARIABLE_NAME = 'Innodb_buffer_pool_reads' THEN VARIABLE_VALUE END) + 0 AS disk_reads, MAX(CASE WHEN VARIABLE_NAME = 'Com_commit' THEN VARIABLE_VALUE END) + MAX(CASE WHEN VARIABLE_NAME = 'Com_rollback' THEN VARIABLE_VALUE END) AS transactions FROM performance_schema.global_status`,
  metricDefs: [{ name: "connections", label: "Connections", kind: "gauge" }, { name: "queries", label: "Queries/s", kind: "counter" }, { name: "transactions", label: "Transactions/s", kind: "counter" }, { name: "cache_hit_ratio", label: "Buffer pool hit ratio", kind: "ratio", of: ["cache_reads_total", "disk_reads"] }],
};

export const mssql: Provider = {
  engine: "mssql",
  sessions: `SELECT CAST(s.session_id AS varchar(20)) AS id, s.login_name AS [user], DB_NAME(s.database_id) AS [database], ISNULL(r.status, s.status) AS state, r.wait_type AS wait, t.text AS query, s.login_time AS started, CASE WHEN s.session_id = @@SPID THEN 1 ELSE 0 END AS is_me FROM sys.dm_exec_sessions s LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t WHERE s.is_user_process = 1`,
  locks: `SELECT CAST(r.session_id AS varchar(20)) AS blocked_id, s.login_name AS blocked_user, t.text AS blocked_query, CAST(r.blocking_session_id AS varchar(20)) AS blocking_id, bs.login_name AS blocking_user, bt.text AS blocking_query, r.wait_time / 1000.0 AS wait_seconds FROM sys.dm_exec_requests r JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id JOIN sys.dm_exec_sessions bs ON bs.session_id = r.blocking_session_id OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t LEFT JOIN sys.dm_exec_connections bc ON bc.session_id = r.blocking_session_id OUTER APPLY sys.dm_exec_sql_text(bc.most_recent_sql_handle) bt WHERE r.blocking_session_id <> 0`,
  slow: (n) => `SELECT TOP (${num(n)}) SUBSTRING(t.text, 1, 2000) AS query, qs.execution_count AS calls, qs.total_elapsed_time / 1000.0 AS total_ms, qs.total_elapsed_time / 1000.0 / qs.execution_count AS mean_ms, qs.total_rows AS [rows] FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t ORDER BY qs.total_elapsed_time DESC`,
  tableStats: `SELECT s.name AS [schema], t.name AS [table], SUM(CASE WHEN p.index_id IN (0, 1) THEN p.rows ELSE 0 END) AS rows_est, SUM(a.total_pages) * 8192 AS size_bytes FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id JOIN sys.indexes i ON i.object_id = t.object_id JOIN sys.partitions p ON p.object_id = i.object_id AND p.index_id = i.index_id JOIN sys.allocation_units a ON a.container_id = p.partition_id GROUP BY s.name, t.name ORDER BY SUM(a.total_pages) DESC`,
  unusedIndexes: `SELECT s.name AS [schema], t.name AS [table], i.name AS [index] FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id JOIN sys.schemas s ON s.schema_id = t.schema_id LEFT JOIN sys.dm_db_index_usage_stats u ON u.object_id = i.object_id AND u.index_id = i.index_id AND u.database_id = DB_ID() WHERE i.is_primary_key = 0 AND i.is_unique = 0 AND i.type > 0 AND ISNULL(u.user_seeks + u.user_scans + u.user_lookups, 0) = 0 ORDER BY 1, 2, 3`,
  variables: `SELECT name, CAST(value_in_use AS nvarchar(100)) AS value, description FROM sys.configurations ORDER BY name`,
  roles: `SELECT name, type_desc AS type, create_date AS created FROM sys.database_principals WHERE type IN ('S', 'U', 'R', 'G') AND name NOT LIKE '##%' ORDER BY name`,
  privileges: (role) => `WITH r AS (SELECT principal_id FROM sys.database_principals WHERE name = ${lit(role)} UNION ALL SELECT m.role_principal_id FROM r JOIN sys.database_role_members m ON m.member_principal_id = r.principal_id) SELECT g.name AS grantee, p.state_desc AS state, p.permission_name AS privilege, ISNULL(OBJECT_SCHEMA_NAME(p.major_id), '') AS [schema], ISNULL(OBJECT_NAME(p.major_id), p.class_desc) AS [object] FROM sys.database_permissions p JOIN sys.database_principals g ON g.principal_id = p.grantee_principal_id WHERE p.grantee_principal_id IN (SELECT principal_id FROM r) ORDER BY 1, 4, 5, 3`,
  kill: (id) => [`KILL ${assertId(id, /^\d+$/, "session id")}`],
  setVariable: (name, v) => ({ statements: [`EXEC sp_configure ${lit(name)}, ${/^-?\d+$/.test(v) ? v : (() => { throw new Error("SQL Server configuration values are integers"); })()}`, "RECONFIGURE"], note: "Some options need 'show advanced options' and a restart." }),
  metrics: `SELECT (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS connections, (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Batch Requests/sec') AS queries, (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Transactions/sec' AND instance_name = '_Total') AS transactions, (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Buffer cache hit ratio') AS cache_hit_num, (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Buffer cache hit ratio base') AS cache_hit_base`,
  metricDefs: [{ name: "connections", label: "Connections", kind: "gauge" }, { name: "queries", label: "Batch requests/s", kind: "counter" }, { name: "transactions", label: "Transactions/s", kind: "counter" }],
};

const ORA_USERS = `(SELECT username FROM dba_users WHERE oracle_maintained = 'N')`;
export const oracle: Provider = {
  engine: "oracle",
  sessions: `SELECT TO_CHAR(s.sid) || ',' || TO_CHAR(s.serial#) AS id, s.username AS "user", s.schemaname AS "database", s.status AS state, s.event AS wait, q.sql_text AS query, s.logon_time AS started, CASE WHEN s.sid = TO_NUMBER(SYS_CONTEXT('USERENV', 'SID')) THEN 1 ELSE 0 END AS is_me FROM v$session s LEFT JOIN v$sql q ON q.sql_id = s.sql_id AND q.child_number = 0 WHERE s.type = 'USER'`,
  locks: `SELECT TO_CHAR(b.sid) || ',' || TO_CHAR(b.serial#) AS blocked_id, b.username AS blocked_user, q.sql_text AS blocked_query, TO_CHAR(k.sid) || ',' || TO_CHAR(k.serial#) AS blocking_id, k.username AS blocking_user, kq.sql_text AS blocking_query, b.seconds_in_wait AS wait_seconds FROM v$session b JOIN v$session k ON k.sid = b.blocking_session LEFT JOIN v$sql q ON q.sql_id = b.sql_id AND q.child_number = 0 LEFT JOIN v$sql kq ON kq.sql_id = NVL(k.sql_id, k.prev_sql_id) AND kq.child_number = 0 WHERE b.blocking_session IS NOT NULL`,
  slow: (n) => `SELECT * FROM (SELECT sql_text AS query, executions AS calls, elapsed_time / 1000 AS total_ms, elapsed_time / 1000 / NULLIF(executions, 0) AS mean_ms, rows_processed AS "rows" FROM v$sql ORDER BY elapsed_time DESC) WHERE ROWNUM <= ${num(n)}`,
  tableStats: `SELECT t.owner AS "schema", t.table_name AS "table", t.num_rows AS rows_est, (SELECT SUM(bytes) FROM dba_segments s WHERE s.owner = t.owner AND s.segment_name = t.table_name) AS size_bytes FROM dba_tables t WHERE t.owner IN ${ORA_USERS} ORDER BY 4 DESC NULLS LAST`,
  unusedIndexes: `SELECT i.owner AS "schema", i.table_name AS "table", i.index_name AS "index" FROM dba_indexes i LEFT JOIN dba_index_usage u ON u.owner = i.owner AND u.name = i.index_name WHERE i.owner IN ${ORA_USERS} AND i.uniqueness = 'NONUNIQUE' AND NVL(u.total_access_count, 0) = 0 ORDER BY 1, 2, 3`,
  variables: `SELECT name, value, description FROM v$parameter ORDER BY name`,
  roles: `SELECT username AS name, account_status AS status, created FROM dba_users WHERE oracle_maintained = 'N' ORDER BY 1`,
  privileges: (role) => { const r = lit(role.toUpperCase()); return `WITH g(grantee) AS (SELECT ${r} FROM dual UNION SELECT granted_role FROM dba_role_privs START WITH grantee = ${r} CONNECT BY PRIOR granted_role = grantee) SELECT grantee, 'SYSTEM' AS "schema", '-' AS "object", privilege FROM dba_sys_privs WHERE grantee IN (SELECT grantee FROM g) UNION ALL SELECT grantee, owner, table_name, privilege FROM dba_tab_privs WHERE grantee IN (SELECT grantee FROM g) ORDER BY 1, 2, 3, 4`; },
  // KILL SESSION without IMMEDIATE marks the session and lets Oracle clean it up; IMMEDIATE terminated the administrator's own connection in testing.
  kill: (id, hard) => [`ALTER SYSTEM ${hard ? "KILL SESSION" : "DISCONNECT SESSION"} ${lit(assertId(id, /^\d+,\d+$/, "session id"))}${hard ? "" : " POST_TRANSACTION"}`],
  setVariable: (name, v) => ({ statements: [`ALTER SYSTEM SET ${assertName(name, "parameter")} = ${value(v)} SCOPE = BOTH`], note: "Static parameters need SCOPE = SPFILE and a restart." }),
  metrics: `SELECT (SELECT COUNT(*) FROM v$session WHERE type = 'USER') AS connections, (SELECT value FROM v$sysstat WHERE name = 'user commits') + (SELECT value FROM v$sysstat WHERE name = 'user rollbacks') AS transactions, (SELECT value FROM v$sysstat WHERE name = 'execute count') AS queries, (SELECT value FROM v$sysstat WHERE name = 'session logical reads') AS cache_reads_total, (SELECT value FROM v$sysstat WHERE name = 'physical reads') AS disk_reads FROM dual`,
  metricDefs: [{ name: "connections", label: "Connections", kind: "gauge" }, { name: "queries", label: "Executions/s", kind: "counter" }, { name: "transactions", label: "Transactions/s", kind: "counter" }, { name: "cache_hit_ratio", label: "Buffer cache hit ratio", kind: "ratio", of: ["cache_reads_total", "disk_reads"] }],
};

export const providers: Record<Engine, Provider> = { postgres, mysql, mssql, oracle };

/** GRANT/REVOKE text for review: object names are quoted per dialect and privileges come from a fixed list. */
const PRIVS = new Set(["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "EXECUTE", "ALL", "ALL PRIVILEGES"]);
export function grantStatement(engine: Engine, action: "GRANT" | "REVOKE", privilege: string, object: { schema?: string; name: string }, role: string): string {
  const p = privilege.toUpperCase(); if (!PRIVS.has(p)) throw new Error(`Unsupported privilege: ${privilege}`);
  assertName(role, "role"); assertName(object.name, "object"); if (object.schema) assertName(object.schema, "schema");
  const q = (n: string) => (engine === "mysql" ? `\`${n}\`` : engine === "mssql" ? `[${n}]` : `"${n}"`);
  const target = object.schema ? `${q(object.schema)}.${q(object.name)}` : q(object.name);
  const who = engine === "mysql" ? `${lit(role)}@'%'` : q(role);
  return `${action} ${p} ON ${target} ${action === "GRANT" ? "TO" : "FROM"} ${who}`;
}

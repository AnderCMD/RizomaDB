import type { Dialect } from "./tokenizer.js";

const COMMON_KW = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN", "ON", "AS", "AND", "OR", "NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "IS NULL", "IS NOT NULL", "DISTINCT", "UNION", "UNION ALL", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "ALTER TABLE", "DROP TABLE", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END", "ASC", "DESC", "LIMIT", "OFFSET", "BEGIN", "COMMIT", "ROLLBACK"];
const FUNCS_COMMON = ["COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST", "UPPER", "LOWER", "TRIM", "LENGTH", "SUBSTRING", "REPLACE", "ABS", "ROUND", "CONCAT"];
const EXTRA_KW: Record<Dialect, string[]> = {
  ansi: [], postgres: ["RETURNING", "ILIKE", "ON CONFLICT", "EXPLAIN ANALYZE", "LATERAL"], mysql: ["SHOW TABLES", "DESCRIBE", "ON DUPLICATE KEY UPDATE", "REPLACE INTO"],
  sqlite: ["PRAGMA", "INSERT OR REPLACE INTO", "AUTOINCREMENT", "GLOB"], mssql: ["TOP", "GO", "DECLARE", "EXEC", "OUTPUT", "NOLOCK", "OFFSET FETCH"], oracle: ["FETCH FIRST", "ROWNUM", "DUAL", "MERGE INTO", "CONNECT BY", "START WITH"],
};
const EXTRA_FN: Record<Dialect, string[]> = {
  ansi: [], postgres: ["NOW", "DATE_TRUNC", "ARRAY_AGG", "STRING_AGG", "JSONB_BUILD_OBJECT", "GENERATE_SERIES", "TO_CHAR", "EXTRACT", "UNNEST"],
  mysql: ["NOW", "DATE_FORMAT", "GROUP_CONCAT", "IFNULL", "JSON_EXTRACT", "CURDATE", "DATEDIFF"], sqlite: ["DATE", "DATETIME", "STRFTIME", "IFNULL", "JSON_EXTRACT", "RANDOM", "GROUP_CONCAT"],
  mssql: ["GETDATE", "DATEADD", "DATEDIFF", "ISNULL", "STRING_AGG", "CONVERT", "LEN", "NEWID", "SYSDATETIME"], oracle: ["NVL", "TO_CHAR", "TO_DATE", "SYSDATE", "LISTAGG", "DECODE", "TRUNC", "SUBSTR", "ROW_NUMBER"],
};
export const keywordsFor = (d: Dialect) => [...COMMON_KW, ...EXTRA_KW[d]];
export const functionsFor = (d: Dialect) => [...FUNCS_COMMON, ...EXTRA_FN[d]];

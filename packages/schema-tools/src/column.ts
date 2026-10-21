import { assertFragment, assertIdentifier, quote } from "./ddl.js";
import { diffModels, migrationStatements, type Statement } from "./diff.js";
import type { ColumnM, Dialect, TableM } from "./model.js";

export type ColumnOp =
  | { op: "rename"; column: string; to: string }
  | { op: "type"; column: string; type: string }
  | { op: "nullable"; column: string; nullable: boolean }
  | { op: "default"; column: string; default?: string }
  | { op: "drop"; column: string }
  | { op: "add"; column: ColumnM };

const lc = (s: string) => s.toLowerCase();

/**
 * DDL for one column edit on one table. Renames are emitted as real RENAME statements (a diff would see drop + add and lose the data);
 * every other edit goes through the same diff/migration code the table designer uses, so type, default and identifier checks are shared.
 */
export function columnStatements(dialect: Dialect, table: TableM, op: ColumnOp): Statement[] {
  const col = (name: string) => {
    const c = table.columns.find((x) => lc(x.name) === lc(name));
    if (!c) throw new Error(`Unknown column: ${name}`);
    return c;
  };
  const tn = table.schema && dialect !== "sqlite" ? `${quote(dialect, table.schema)}.${quote(dialect, table.name)}` : quote(dialect, table.name);

  if (op.op === "rename") {
    const from = col(op.column);
    assertIdentifier(op.to);
    if (lc(op.to) !== lc(from.name) && table.columns.some((x) => lc(x.name) === lc(op.to))) throw new Error(`Column ${op.to} already exists`);
    if (dialect === "mssql") {
      const path = `${table.schema ? `${table.schema}.` : ""}${table.name}.${from.name}`.replaceAll("'", "''");
      return [{ sql: `EXEC sp_rename N'${path}', N'${op.to.replaceAll("'", "''")}', N'COLUMN'` }];
    }
    return [{ sql: `ALTER TABLE ${tn} RENAME COLUMN ${quote(dialect, from.name)} TO ${quote(dialect, op.to)}` }];
  }

  let columns: ColumnM[];
  if (op.op === "add") {
    if (table.columns.some((x) => lc(x.name) === lc(op.column.name))) throw new Error(`Column ${op.column.name} already exists`);
    assertIdentifier(op.column.name); assertFragment("type", op.column.type); if (op.column.default !== undefined) assertFragment("default", op.column.default);
    columns = [...table.columns, op.column];
  } else {
    const target = col(op.column);
    if (op.op === "drop") {
      if (table.primaryKey.some((k) => lc(k) === lc(target.name))) throw new Error(`${target.name} is part of the primary key`);
      columns = table.columns.filter((x) => x !== target);
    } else {
      columns = table.columns.map((x) => {
        if (x !== target) return x;
        if (op.op === "type") { assertFragment("type", op.type); return { ...x, type: op.type }; }
        if (op.op === "nullable") {
          if (!op.nullable && table.primaryKey.some((k) => lc(k) === lc(x.name))) throw new Error(`${x.name} is part of the primary key`);
          return { ...x, nullable: op.nullable };
        }
        const { default: _old, ...rest } = x; void _old;
        if (op.default !== undefined) assertFragment("default", op.default);
        return op.default === undefined || op.default.trim() === "" ? rest : { ...rest, default: op.default };
      });
    }
  }
  const diff = diffModels({ dialect, tables: [table] }, { dialect, tables: [{ ...table, columns }] });
  return migrationStatements(dialect, diff.changes);
}

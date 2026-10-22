/** Commands the "Edit Value" action sends for the Redis types it can change in place. Arguments are JSON-quoted, which the Redis command parser reads back exactly. */
export type EditableRedisType = "string" | "hash" | "list";
export const isEditableRedisType = (type: string): type is EditableRedisType => type === "string" || type === "hash" || type === "list";

const q = (s: string) => JSON.stringify(s);
export const READ_LIMIT = 1000;

export function readCommand(type: EditableRedisType, key: string): string {
  return type === "string" ? `GET ${q(key)}` : type === "hash" ? `HGETALL ${q(key)}` : `LRANGE ${q(key)} 0 ${READ_LIMIT - 1}`;
}

/** `target` is the hash field or the list index; a string has none. A string keeps its expiry (KEEPTTL). */
export function writeCommand(type: EditableRedisType, key: string, target: string | number | undefined, value: string): string {
  if (type === "string") return `SET ${q(key)} ${q(value)} KEEPTTL`;
  if (target === undefined) throw new Error("A hash field or list index is required");
  if (type === "hash") return `HSET ${q(key)} ${q(String(target))} ${q(value)}`;
  if (!Number.isInteger(Number(target)) || Number(target) < 0) throw new Error("A list index must be a whole number from 0");
  return `LSET ${q(key)} ${Number(target)} ${q(value)}`;
}

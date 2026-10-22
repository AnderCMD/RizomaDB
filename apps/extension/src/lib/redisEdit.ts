/** Commands the "Edit Value" action sends for the Redis types it can change in place. Arguments are JSON-quoted, which the Redis command parser reads back exactly. */
export type EditableRedisType = "string" | "hash" | "list" | "set" | "zset";
export const isEditableRedisType = (type: string): type is EditableRedisType => ["string", "hash", "list", "set", "zset"].includes(type);

const q = (s: string) => JSON.stringify(s);
export const READ_LIMIT = 1000;

export function readCommand(type: EditableRedisType, key: string): string {
  return type === "string" ? `GET ${q(key)}` : type === "hash" ? `HGETALL ${q(key)}` : type === "set" ? `SMEMBERS ${q(key)}` : type === "zset" ? `ZRANGE ${q(key)} 0 ${READ_LIMIT - 1} WITHSCORES` : `LRANGE ${q(key)} 0 ${READ_LIMIT - 1}`;
}

/**
 * The commands that apply one edit, in order. `target` is the hash field, list index, set member or sorted-set member; a string has none.
 * A string keeps its expiry (KEEPTTL). A set member is renamed by adding the new one first, so a failure never loses it; a sorted-set edit changes the score of an existing member only (XX).
 */
export function writeCommands(type: EditableRedisType, key: string, target: string | number | undefined, value: string): string[] {
  if (type === "string") return [`SET ${q(key)} ${q(value)} KEEPTTL`];
  if (target === undefined) throw new Error("An element to edit is required");
  if (type === "hash") return [`HSET ${q(key)} ${q(String(target))} ${q(value)}`];
  if (type === "set") return value === String(target) ? [] : [`SADD ${q(key)} ${q(value)}`, `SREM ${q(key)} ${q(String(target))}`];
  if (type === "zset") {
    if (value.trim() === "" || !Number.isFinite(Number(value))) throw new Error("A score must be a number");
    return [`ZADD ${q(key)} XX ${Number(value)} ${q(String(target))}`];
  }
  if (!Number.isInteger(Number(target)) || Number(target) < 0) throw new Error("A list index must be a whole number from 0");
  return [`LSET ${q(key)} ${Number(target)} ${q(value)}`];
}
export const writeCommand = (type: EditableRedisType, key: string, target: string | number | undefined, value: string) => writeCommands(type, key, target, value)[0] ?? "";

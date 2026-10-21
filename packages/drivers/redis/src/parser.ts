export class RedisSyntaxError extends Error {
  constructor(message: string, readonly position: number) { super(message); this.name = "RedisSyntaxError"; }
}

/** Splits a redis-cli style line into arguments: "double" (with \n \t \xHH escapes), 'single' and bare words. */
export function parseCommandLine(line: string): string[] {
  const args: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    while (i < n && /\s/.test(line[i]!)) i++;
    if (i >= n) break;
    let cur = "";
    const start = i;
    while (i < n && !/\s/.test(line[i]!)) {
      const c = line[i]!;
      if (c === '"') {
        i++;
        for (;;) {
          if (i >= n) throw new RedisSyntaxError("Unterminated double-quoted string", start);
          const d = line[i]!;
          if (d === '"') { i++; break; }
          if (d === "\\") {
            const e = line[i + 1];
            if (e === "x" && /^[0-9a-fA-F]{2}$/.test(line.slice(i + 2, i + 4))) { cur += String.fromCharCode(parseInt(line.slice(i + 2, i + 4), 16)); i += 4; continue; }
            cur += ({ n: "\n", r: "\r", t: "\t", b: "\b", a: "\x07" } as Record<string, string>)[e ?? ""] ?? e ?? ""; i += 2; continue;
          }
          cur += d; i++;
        }
        if (i < n && !/\s/.test(line[i]!)) throw new RedisSyntaxError("Closing quote must be followed by a space", i);
      } else if (c === "'") {
        i++;
        for (;;) {
          if (i >= n) throw new RedisSyntaxError("Unterminated single-quoted string", start);
          if (line[i] === "\\" && line[i + 1] === "'") { cur += "'"; i += 2; continue; }
          if (line[i] === "'") { i++; break; }
          cur += line[i++];
        }
        if (i < n && !/\s/.test(line[i]!)) throw new RedisSyntaxError("Closing quote must be followed by a space", i);
      } else { cur += c; i++; }
    }
    args.push(cur);
  }
  return args;
}

export type Risk = "none" | "write" | "destructive";
export interface Assessment { risk: Risk; reasons: string[] }

const READ = new Set(["GET", "MGET", "GETRANGE", "STRLEN", "EXISTS", "TYPE", "TTL", "PTTL", "EXPIRETIME", "SCAN", "OPEN", "HGET", "HGETALL", "HKEYS", "HVALS", "HLEN", "HMGET", "HEXISTS", "HSCAN", "HSTRLEN",
  "LRANGE", "LLEN", "LINDEX", "LPOS", "SMEMBERS", "SCARD", "SISMEMBER", "SMISMEMBER", "SSCAN", "SRANDMEMBER", "SINTER", "SUNION", "SDIFF", "ZRANGE", "ZRANGEBYSCORE", "ZREVRANGE", "ZREVRANGEBYSCORE", "ZRANGEBYLEX", "ZCARD", "ZCOUNT", "ZSCORE", "ZRANK", "ZREVRANK", "ZSCAN", "ZMSCORE",
  "XRANGE", "XREVRANGE", "XLEN", "XREAD", "XINFO", "DBSIZE", "PING", "ECHO", "TIME", "DUMP", "RANDOMKEY", "INFO", "LASTSAVE", "BITCOUNT", "BITPOS", "GETBIT", "PFCOUNT", "GEOPOS", "GEODIST", "GEOSEARCH", "JSON.GET", "JSON.TYPE", "JSON.STRLEN", "JSON.OBJKEYS", "JSON.ARRLEN", "TS.GET", "TS.RANGE", "TS.INFO", "OBJECT", "MEMORY", "COMMAND", "SLOWLOG", "LATENCY", "CLIENT", "CONFIG", "SCRIPT", "ACL"]);
const READ_SUB: Record<string, Set<string>> = {
  CONFIG: new Set(["GET"]), CLIENT: new Set(["LIST", "INFO", "GETNAME", "ID", "TRACKINGINFO"]), MEMORY: new Set(["USAGE", "STATS", "DOCTOR", "MALLOC-STATS"]), OBJECT: new Set(["ENCODING", "FREQ", "IDLETIME", "REFCOUNT", "HELP"]),
  SLOWLOG: new Set(["GET", "LEN"]), COMMAND: new Set(["INFO", "COUNT", "DOCS", "LIST", "GETKEYS"]), LATENCY: new Set(["LATEST", "HISTORY", "DOCTOR", "GRAPH"]), XINFO: new Set(["STREAM", "GROUPS", "CONSUMERS", "HELP"]), SCRIPT: new Set(["EXISTS"]), ACL: new Set(["WHOAMI", "LIST", "USERS", "GETUSER", "CAT"]),
};
const DESTRUCTIVE = new Set(["FLUSHALL", "FLUSHDB", "SHUTDOWN", "DEBUG", "REPLICAOF", "SLAVEOF", "MIGRATE", "CLUSTER", "FAILOVER", "MODULE", "BGREWRITEAOF", "SAVE", "BGSAVE", "MONITOR", "SYNC", "PSYNC"]);

/** Static classification (the server's own flags need a connection). Unknown commands count as writes. */
export function assessRedis(text: string): Assessment {
  let a: string[];
  try { a = parseCommandLine(text); } catch { return { risk: "none", reasons: [] }; }
  const cmd = a[0]?.toUpperCase() ?? "";
  if (!cmd) return { risk: "none", reasons: [] };
  const sub = a[1]?.toUpperCase() ?? "";
  if (DESTRUCTIVE.has(cmd)) return { risk: "destructive", reasons: [`${cmd} ${cmd === "FLUSHALL" || cmd === "FLUSHDB" ? "erases every key" : "changes the server"}`] };
  if (cmd === "CONFIG" && /^(SET|REWRITE|RESETSTAT)$/.test(sub)) return { risk: "destructive", reasons: [`CONFIG ${sub} changes the server configuration`] };
  if (cmd === "SCRIPT" && sub === "FLUSH") return { risk: "destructive", reasons: ["SCRIPT FLUSH drops cached scripts"] };
  if (READ.has(cmd)) {
    const subs = READ_SUB[cmd];
    if (!subs || subs.has(sub)) return { risk: "none", reasons: [] };
  }
  if (cmd === "DEL" || cmd === "UNLINK") return { risk: a.length > 2 ? "destructive" : "write", reasons: [`${cmd} removes ${a.length - 1} key(s)`] };
  return { risk: "write", reasons: [`${cmd} may modify data`] };
}

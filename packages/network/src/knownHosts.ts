import { createHmac, timingSafeEqual } from "node:crypto";

export interface HostKeyEntry { patterns: string[]; hashed?: { salt: Buffer; hash: Buffer }; keyType: string; key: Buffer }

/** Parses OpenSSH known_hosts text (plain and hashed `|1|salt|hash` host fields). Revoked/cert-authority lines are ignored. */
export function parseKnownHosts(text: string): HostKeyEntry[] {
  const out: HostKeyEntry[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("@")) continue;
    const [hosts, keyType, b64] = line.split(/\s+/);
    if (!hosts || !keyType || !b64) continue;
    let key: Buffer;
    try { key = Buffer.from(b64, "base64"); } catch { continue; }
    if (hosts.startsWith("|1|")) {
      const [, , salt, hash] = hosts.split("|");
      if (salt && hash) out.push({ patterns: [], hashed: { salt: Buffer.from(salt, "base64"), hash: Buffer.from(hash, "base64") }, keyType, key });
    } else out.push({ patterns: hosts.split(","), keyType, key });
  }
  return out;
}

const hostToken = (host: string, port: number) => (port === 22 ? host : `[${host}]:${port}`);

function glob(pattern: string, s: string): boolean {
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|\\]/g, "\\$&").replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("*", ".*").replaceAll("?", ".") + "$", "i");
  return re.test(s);
}

export function entriesFor(entries: HostKeyEntry[], host: string, port: number): HostKeyEntry[] {
  const token = hostToken(host, port);
  return entries.filter((e) => {
    if (e.hashed) {
      const h = createHmac("sha1", e.hashed.salt).update(token).digest();
      return h.length === e.hashed.hash.length && timingSafeEqual(h, e.hashed.hash);
    }
    const neg = e.patterns.filter((p) => p.startsWith("!"));
    if (neg.some((p) => glob(p.slice(1), token))) return false;
    return e.patterns.some((p) => !p.startsWith("!") && glob(p, token));
  });
}

export type HostKeyDecision = { status: "trusted" } | { status: "unknown" } | { status: "changed" };

/** Strict: a host is only trusted if an entry exists for it AND the key matches. Unknown never auto-accepts. */
export function checkHostKey(entries: HostKeyEntry[], host: string, port: number, presented: Buffer): HostKeyDecision {
  const matches = entriesFor(entries, host, port);
  if (matches.length === 0) return { status: "unknown" };
  return matches.some((e) => e.key.length === presented.length && timingSafeEqual(e.key, presented)) ? { status: "trusted" } : { status: "changed" };
}

export const fingerprint = (key: Buffer) => "SHA256:" + createHmacless(key);
import { createHash } from "node:crypto";
function createHmacless(key: Buffer) { return createHash("sha256").update(key).digest("base64").replace(/=+$/, ""); }

/** Serializes an entry for appending after the user explicitly trusts a key. */
export function formatEntry(host: string, port: number, keyType: string, key: Buffer): string {
  return `${hostToken(host, port)} ${keyType} ${key.toString("base64")}\n`;
}

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { parseProfile, type ConnectionProfile } from "@rizomadb/core";

/**
 * A connection catalog sealed with a passphrase, to move connections between machines or teammates through any channel.
 * It holds profiles only: secrets live in the secret store and are never in it, so the receiver is asked for them on first connect.
 * scrypt derives the key; AES-256-GCM authenticates the content, so a wrong passphrase or a tampered file is rejected, never half-read.
 */
export const SEALED_FORMAT = "rizomadb-sealed-catalog";
const KDF = { N: 2 ** 15, r: 8, p: 1 } as const;
export const MIN_PASSPHRASE = 8;

export class SealedCatalogError extends Error { constructor(readonly code: "not-sealed" | "wrong-passphrase" | "invalid" | "weak-passphrase") { super(code); } }

const key = (pass: string, salt: Buffer, kdf: { N: number; r: number; p: number }) => scryptSync(pass, salt, 32, { ...kdf, maxmem: 128 * kdf.N * kdf.r * 2 });

export function seal(profiles: ConnectionProfile[], passphrase: string): string {
  if (passphrase.length < MIN_PASSPHRASE) throw new SealedCatalogError("weak-passphrase");
  const salt = randomBytes(16), iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(passphrase, salt, KDF), iv);
  const body = Buffer.concat([c.update(JSON.stringify({ version: 1, connections: profiles }), "utf8"), c.final()]);
  return `${JSON.stringify({ format: SEALED_FORMAT, v: 1, kdf: { ...KDF, salt: salt.toString("base64") }, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: body.toString("base64") }, null, 1)}\n`;
}

export function unseal(text: string, passphrase: string): ConnectionProfile[] {
  let f: { format?: unknown; v?: unknown; kdf?: { N?: unknown; r?: unknown; p?: unknown; salt?: unknown }; iv?: unknown; tag?: unknown; data?: unknown };
  try { f = JSON.parse(text); } catch { throw new SealedCatalogError("not-sealed"); }
  const k = f?.kdf;
  if (f?.format !== SEALED_FORMAT || f.v !== 1 || typeof f.iv !== "string" || typeof f.tag !== "string" || typeof f.data !== "string" || !k || typeof k.salt !== "string") throw new SealedCatalogError("not-sealed");
  // The cost parameters come from the file: bound them so a crafted file cannot make the machine hang or run out of memory.
  const N = Number(k.N), r = Number(k.r), p = Number(k.p);
  if (![N, r, p].every(Number.isInteger) || N < 2 ** 14 || N > 2 ** 17 || (N & (N - 1)) !== 0 || r < 1 || r > 16 || p < 1 || p > 4) throw new SealedCatalogError("invalid");
  let plain: string;
  try {
    const d = createDecipheriv("aes-256-gcm", key(passphrase, Buffer.from(k.salt, "base64"), { N, r, p }), Buffer.from(f.iv, "base64"));
    d.setAuthTag(Buffer.from(f.tag, "base64"));
    plain = Buffer.concat([d.update(Buffer.from(f.data, "base64")), d.final()]).toString("utf8");
  } catch { throw new SealedCatalogError("wrong-passphrase"); }
  try {
    const list = (JSON.parse(plain) as { connections?: unknown[] }).connections;
    if (!Array.isArray(list)) throw new Error("no list");
    return list.map((x) => parseProfile(x));
  } catch { throw new SealedCatalogError("invalid"); }
}

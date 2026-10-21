import { createHash, createHmac } from "node:crypto";

export interface Credentials { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
export interface SignInput { method: string; host: string; path: string; query?: string; headers: Record<string, string>; body: string; region: string; service: string; now?: Date }

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();

/** AWS Signature Version 4. Returns the headers to add (host included) to the request. */
export function signV4(c: Credentials, i: SignInput): Record<string, string> {
  const now = i.now ?? new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = { ...Object.fromEntries(Object.entries(i.headers).map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, " ")])), host: i.host, "x-amz-date": amzDate };
  if (c.sessionToken) headers["x-amz-security-token"] = c.sessionToken;
  const names = Object.keys(headers).sort();
  const canonical = [i.method, i.path || "/", i.query ?? "", ...names.map((n) => `${n}:${headers[n]}`), "", names.join(";"), sha256(i.body)].join("\n");
  const scope = `${day}/${i.region}/${i.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${c.secretAccessKey}`, day), i.region), i.service), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign, "utf8").digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
  return headers;
}

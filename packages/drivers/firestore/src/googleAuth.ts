import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";

export class GoogleAuthError extends Error {}

export type GoogleCredentials =
  | { type: "service_account"; client_email: string; private_key: string; token_uri: string }
  | { type: "authorized_user"; client_id: string; client_secret: string; refresh_token: string; token_uri: string };

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

/** Where `gcloud auth application-default login` writes its file, unless GOOGLE_APPLICATION_CREDENTIALS points elsewhere. */
export function defaultCredentialsPath(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): string | undefined {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) return env.GOOGLE_APPLICATION_CREDENTIALS;
  const p = env.APPDATA ? join(env.APPDATA, "gcloud", "application_default_credentials.json") : join(homedir(), ".config", "gcloud", "application_default_credentials.json");
  return exists(p) ? p : undefined;
}

/** The token endpoint must be HTTPS (a loopback address may use HTTP, which lets tests run a local stand-in). */
function checkTokenUri(uri: string): string {
  let u: URL;
  try { u = new URL(uri); } catch { throw new GoogleAuthError("The credentials file has an invalid token_uri."); }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(loopback && u.protocol === "http:")) throw new GoogleAuthError("The credentials file's token_uri must use https.");
  return u.toString();
}

export function loadGoogleCredentials(path: string, read: (p: string) => string = (p) => readFileSync(p, "utf8")): GoogleCredentials {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(read(path)) as Record<string, unknown>; } catch (e) { throw new GoogleAuthError(`Cannot read the credentials file ${path}: ${(e as Error).message}`); }
  const str = (k: string): string => { const v = raw[k]; if (typeof v !== "string" || !v) throw new GoogleAuthError(`The credentials file has no "${k}".`); return v; };
  const token_uri = checkTokenUri(typeof raw.token_uri === "string" && raw.token_uri ? raw.token_uri : DEFAULT_TOKEN_URI);
  if (raw.type === "service_account") return { type: "service_account", client_email: str("client_email"), private_key: str("private_key"), token_uri };
  if (raw.type === "authorized_user") return { type: "authorized_user", client_id: str("client_id"), client_secret: str("client_secret"), refresh_token: str("refresh_token"), token_uri };
  throw new GoogleAuthError(`The credentials file has type "${String(raw.type)}"; only service_account keys and authorized_user files (from gcloud auth application-default login) are supported.`);
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
/** The signed request a service account sends to prove who it is (RFC 7523). */
export function serviceAccountAssertion(c: Extract<GoogleCredentials, { type: "service_account" }>, nowSec: number): string {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: c.client_email, scope: SCOPE, aud: c.token_uri, iat: nowSec, exp: nowSec + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(c.private_key);
  return `${head}.${body}.${b64u(sig)}`;
}

export type PostForm = (url: string, form: Record<string, string>) => Promise<{ status: number; body: string }>;
export const postForm: PostForm = (url, form) => new Promise((resolve, reject) => {
  const u = new URL(url), payload = new URLSearchParams(form).toString(), lib = u.protocol === "https:" ? https : http;
  const req = lib.request(u, { method: "POST", timeout: 15000, headers: { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(payload) } }, (res) => {
    const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
  });
  req.on("timeout", () => req.destroy(new Error("The token request timed out.")));
  req.on("error", reject); req.end(payload);
});

/** Gives a valid access token, asking Google for a new one a minute before the old one expires. Nothing is written to disk. */
export function tokenSource(creds: GoogleCredentials, post: PostForm = postForm, now: () => number = Date.now): () => Promise<string> {
  let cached: { token: string; until: number } | undefined, inflight: Promise<string> | undefined;
  const fetchToken = async (): Promise<string> => {
    const form: Record<string, string> = creds.type === "service_account"
      ? { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountAssertion(creds, Math.floor(now() / 1000)) }
      : { grant_type: "refresh_token", client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token };
    const res = await post(creds.token_uri, form);
    let json: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = {};
    try { json = JSON.parse(res.body); } catch { /* not JSON */ }
    if (res.status !== 200 || !json.access_token) throw new GoogleAuthError(`Google did not give an access token (${json.error ?? `HTTP ${res.status}`}${json.error_description ? `: ${json.error_description}` : ""}).`);
    cached = { token: json.access_token, until: now() + Math.max(0, (json.expires_in ?? 3600) - 60) * 1000 };
    return json.access_token;
  };
  return async () => {
    if (cached && now() < cached.until) return cached.token;
    return (inflight ??= fetchToken().finally(() => { inflight = undefined; }));
  };
}

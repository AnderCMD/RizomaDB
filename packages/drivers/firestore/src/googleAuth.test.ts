import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "node:http";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import { defaultCredentialsPath, GoogleAuthError, loadGoogleCredentials, serviceAccountAssertion, tokenSource } from "./googleAuth.js";
import { firestoreDriver } from "./index.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });

// A local stand-in for Google's token endpoint that records every request.
const posts: URLSearchParams[] = [];
let tokenCounter = 0, failNext = false;
const tokenServer = createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    posts.push(new URLSearchParams(body));
    if (failNext) { failNext = false; res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "invalid_grant", error_description: "Bad key" })); return; }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ access_token: `tok-${++tokenCounter}`, expires_in: 3600 }));
  });
});
await new Promise<void>((r) => tokenServer.listen(0, "127.0.0.1", r));
const tokenUri = `http://127.0.0.1:${(tokenServer.address() as AddressInfo).port}/token`;
afterAll(() => { tokenServer.close(); });

const sa = JSON.stringify({ type: "service_account", client_email: "svc@proj.iam.gserviceaccount.com", private_key: privateKey, token_uri: tokenUri });
const user = JSON.stringify({ type: "authorized_user", client_id: "cid", client_secret: "csec", refresh_token: "rtok", token_uri: tokenUri });
const files: Record<string, string> = { "/sa.json": sa, "/user.json": user, "/other.json": JSON.stringify({ type: "external_account" }), "/http.json": JSON.stringify({ type: "authorized_user", client_id: "a", client_secret: "b", refresh_token: "c", token_uri: "http://evil.example/token" }) };
const read = (p: string) => { if (p in files) return files[p]!; throw new Error("ENOENT"); };

describe("Google credentials", () => {
  it("loads service-account and authorized-user files and refuses anything else", () => {
    expect(loadGoogleCredentials("/sa.json", read).type).toBe("service_account");
    expect(loadGoogleCredentials("/user.json", read).type).toBe("authorized_user");
    expect(() => loadGoogleCredentials("/other.json", read)).toThrow(/only service_account/);
    expect(() => loadGoogleCredentials("/missing.json", read)).toThrow(GoogleAuthError);
    expect(() => loadGoogleCredentials("/http.json", read)).toThrow(/https/);
  });
  it("finds the default file from the environment or the gcloud folder", () => {
    expect(defaultCredentialsPath({ GOOGLE_APPLICATION_CREDENTIALS: "/x.json" }, () => false)).toBe("/x.json");
    expect(defaultCredentialsPath({}, () => false)).toBeUndefined();
    expect(defaultCredentialsPath({}, () => true)).toMatch(/application_default_credentials\.json$/);
  });
  it("signs a service-account assertion that verifies with the public key", () => {
    const c = loadGoogleCredentials("/sa.json", read);
    if (c.type !== "service_account") throw new Error("type");
    const jwt = serviceAccountAssertion(c, 1_700_000_000), [h, b, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(b!, "base64url").toString())).toMatchObject({ iss: "svc@proj.iam.gserviceaccount.com", scope: "https://www.googleapis.com/auth/datastore", aud: tokenUri, iat: 1_700_000_000, exp: 1_700_003_600 });
    expect(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(createPublicKey(publicKey), Buffer.from(s!, "base64url"))).toBe(true);
  });
});

describe("token exchange against a local token endpoint", () => {
  it("caches the token until a minute before it expires, then asks again", async () => {
    let t = 1_000_000; posts.length = 0;
    const get = tokenSource(loadGoogleCredentials("/user.json", read), undefined, () => t);
    const a = await get(), b = await get();
    expect(a).toBe(b); expect(posts).toHaveLength(1);
    expect(Object.fromEntries(posts[0]!)).toEqual({ grant_type: "refresh_token", client_id: "cid", client_secret: "csec", refresh_token: "rtok" });
    t += 3541_000; // 3541 s later: inside the last minute
    expect(await get()).not.toBe(a); expect(posts).toHaveLength(2);
  });
  it("sends the signed assertion for a service account and reports a rejection clearly", async () => {
    posts.length = 0;
    const get = tokenSource(loadGoogleCredentials("/sa.json", read));
    await get();
    expect(posts[0]!.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(posts[0]!.get("assertion")!.split(".")).toHaveLength(3);
    failNext = true;
    await expect(tokenSource(loadGoogleCredentials("/sa.json", read))()).rejects.toThrow(/invalid_grant: Bad key/);
  });
});

describe("Firestore connection with a credentials file", () => {
  it("explains what is missing when there is no token and no file", async () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS; delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    try {
      await expect(firestoreDriver.connect({ projectId: "p", credentialsFile: "/definitely/missing.json" }, { log() {} })).rejects.toMatchObject({ kind: "authentication", message: expect.stringContaining("Cannot read the credentials file") });
    } finally { if (prev !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev; }
  });
});

import { describe, it, expect, afterAll } from "vitest";
import { createServer, type IncomingMessage } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { dynamodbDriver } from "./index.js";

// A local stand-in for the endpoint that records how each request was signed: the proof that profile keys, not "local" ones, reach the wire.
const seen: IncomingMessage["headers"][] = [];
const server = createServer((req, res) => { seen.push(req.headers); req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/x-amz-json-1.0" }); res.end(JSON.stringify({ TableNames: [] })); }); });
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as AddressInfo).port;
afterAll(() => { server.close(); });

describe("DynamoDB connection with an AWS profile", () => {
  const dir = mkdtempSync(join(tmpdir(), "rz-aws-"));
  writeFileSync(join(dir, "credentials"), "[work]\naws_access_key_id=AKIAFROMPROFILE\naws_secret_access_key=sekret\naws_session_token=SESSIONTOK\n[sso]\naws_access_key_id=a\naws_secret_access_key=b\n");
  writeFileSync(join(dir, "config"), "[profile work]\nregion = eu-central-1\n[profile sso]\nsso_session = corp\n");
  const prev = { c: process.env.AWS_SHARED_CREDENTIALS_FILE, f: process.env.AWS_CONFIG_FILE };
  process.env.AWS_SHARED_CREDENTIALS_FILE = join(dir, "credentials"); process.env.AWS_CONFIG_FILE = join(dir, "config");
  afterAll(() => { if (prev.c === undefined) delete process.env.AWS_SHARED_CREDENTIALS_FILE; else process.env.AWS_SHARED_CREDENTIALS_FILE = prev.c; if (prev.f === undefined) delete process.env.AWS_CONFIG_FILE; else process.env.AWS_CONFIG_FILE = prev.f; });
  const endpoint = { host: "127.0.0.1", port, ssl: false };

  it("signs requests with the profile's keys and session token", async () => {
    const conn = await dynamodbDriver.connect({ profile: "work", region: "", ...endpoint }, { log() {} });
    await conn.ping(); await conn.close();
    const h = seen.at(-1)!;
    expect(String(h.authorization)).toContain("Credential=AKIAFROMPROFILE/");
    expect(String(h.authorization)).toContain("/eu-central-1/dynamodb/aws4_request");
    expect(h["x-amz-security-token"]).toBe("SESSIONTOK");
  });
  it("prefers keys typed in the connection over the profile", async () => {
    const conn = await dynamodbDriver.connect({ profile: "work", accessKeyId: "AKIATYPED", secretAccessKey: "x", region: "us-east-1", ...endpoint }, { log() {} });
    await conn.close();
    expect(String(seen.at(-1)!.authorization)).toContain("Credential=AKIATYPED/");
  });
  it("explains why a profile cannot be used", async () => {
    await expect(dynamodbDriver.connect({ profile: "sso", ...endpoint }, { log() {} })).rejects.toMatchObject({ kind: "authentication", message: expect.stringContaining("sso_session") });
    await expect(dynamodbDriver.connect({ profile: "nope", ...endpoint }, { log() {} })).rejects.toMatchObject({ kind: "authentication" });
  });
});

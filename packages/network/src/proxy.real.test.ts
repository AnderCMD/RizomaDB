import { describe, it, expect, afterEach } from "vitest";
import net from "node:net";
import { openProxyTunnel, ProxyError, type ProxySettings } from "./index.js";

/**
 * The proxy client against real proxy servers (Squid for HTTP CONNECT, a SOCKS5 server), reaching a real PostgreSQL through them.
 * PostgreSQL answers an SSLRequest with one byte, so getting it back proves the bytes crossed the proxy to the server.
 */
const squidOpen = Number(process.env.RZ_SQUID_PORT ?? 13128), squidAuth = Number(process.env.RZ_SQUID_AUTH_PORT ?? 13129), socksPort = Number(process.env.RZ_SOCKS5_PORT ?? 11080);
// The proxies run in the same compose network as the postgres service, so they reach it by service name and its in-container port.
const target = { host: "postgres", port: 5432 };

const portOpen = (port: number) => new Promise<boolean>((resolve) => {
  const s = net.connect(port, "127.0.0.1"); s.setTimeout(1500, () => { s.destroy(); resolve(false); });
  s.once("connect", () => { s.destroy(); resolve(true); }); s.once("error", () => resolve(false));
});
const up = (await Promise.all([portOpen(squidOpen), portOpen(socksPort)])).every(Boolean);
const required = !!process.env["RZ_REQUIRE_ENGINES"] && !(process.env["RZ_SKIP_ENGINES"] ?? "").includes("proxies");

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of closers.splice(0)) await c(); });

async function sslRequest(port: number): Promise<string> {
  const s = net.connect(port, "127.0.0.1");
  return new Promise((resolve, reject) => {
    s.once("error", reject); s.setTimeout(10_000, () => reject(new Error("no answer")));
    s.once("connect", () => s.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])));
    s.once("data", (d) => { s.destroy(); resolve(d.toString("latin1")); });
  });
}
async function through(proxy: ProxySettings) {
  const t = await openProxyTunnel({ proxy, target });
  closers.push(() => t.close());
  return sslRequest(t.localPort);
}

it.runIf(required && !up)("the proxy containers are required in CI", () => { throw new Error("squid, socks5 and postgres must be running (docker compose -f test/compose/docker-compose.yml up -d postgres squid socks5)"); });

describe.skipIf(!up)("proxies, real servers", () => {
  it("HTTP CONNECT through Squid reaches the database", async () => {
    expect(["N", "S"]).toContain(await through({ type: "http", host: "127.0.0.1", port: squidOpen }));
  });
  it("HTTP CONNECT with the right and wrong credentials", async () => {
    expect(["N", "S"]).toContain(await through({ type: "http", host: "127.0.0.1", port: squidAuth, username: "rizoma", password: "rizoma_test" }));
    await expect(through({ type: "http", host: "127.0.0.1", port: squidAuth, username: "rizoma", password: "wrong" })).rejects.toMatchObject({ stage: "auth" });
    await expect(through({ type: "http", host: "127.0.0.1", port: squidAuth })).rejects.toBeInstanceOf(ProxyError);
  });
  it("SOCKS5 with username and password reaches the database", async () => {
    expect(["N", "S"]).toContain(await through({ type: "socks5", host: "127.0.0.1", port: socksPort, username: "rizoma", password: "rizoma_test" }));
  });
  it("SOCKS5 rejects wrong credentials", async () => {
    await expect(through({ type: "socks5", host: "127.0.0.1", port: socksPort, username: "rizoma", password: "wrong" })).rejects.toMatchObject({ stage: "auth" });
  });
  it("refuses a target the proxy cannot reach, with a clear error", async () => {
    await expect(openProxyTunnel({ proxy: { type: "http", host: "127.0.0.1", port: squidOpen }, target: { host: "postgres", port: 1 } })).rejects.toBeInstanceOf(ProxyError);
    await expect(openProxyTunnel({ proxy: { type: "socks5", host: "127.0.0.1", port: socksPort, username: "rizoma", password: "rizoma_test" }, target: { host: "postgres", port: 1 } })).rejects.toBeInstanceOf(ProxyError);
  });
});

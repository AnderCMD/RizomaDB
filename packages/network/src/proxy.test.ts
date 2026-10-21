import { describe, it, expect, afterEach } from "vitest";
import net from "node:net";
import { openProxyTunnel, ProxyError } from "./index.js";

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of closers.splice(0)) await c(); });
const listen = (srv: net.Server) => new Promise<number>((r) => srv.listen(0, "127.0.0.1", () => r((srv.address() as net.AddressInfo).port)));
const track = (srv: net.Server) => closers.push(() => new Promise((r) => srv.close(() => r())));

/** A TCP server that answers "echo:<data>" so the tests prove the bytes crossed the proxy. */
async function echoServer() {
  const srv = net.createServer((s) => { s.on("data", (d) => s.write(`echo:${d}`)); s.on("error", () => {}); });
  track(srv); return { port: await listen(srv) };
}

/** Minimal HTTP CONNECT proxy; records requested targets and Proxy-Authorization headers. */
async function httpProxy(opts: { auth?: string } = {}) {
  const seen: { target: string; auth?: string }[] = [];
  const srv = net.createServer((c) => {
    c.on("error", () => {});
    let buf = "";
    const onData = (d: Buffer) => {
      buf += d.toString("latin1"); const end = buf.indexOf("\r\n\r\n"); if (end < 0) return;
      c.off("data", onData);
      const lines = buf.slice(0, end).split("\r\n"); const target = /^CONNECT (\S+)/.exec(lines[0]!)?.[1] ?? "";
      const auth = lines.find((l) => /^proxy-authorization:/i.test(l))?.split(": ")[1];
      seen.push({ target, ...(auth ? { auth } : {}) });
      if (opts.auth && auth !== opts.auth) { c.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n"); return; }
      const [h, p] = target.split(":"); const up = net.connect(Number(p), h === "localhost" ? "127.0.0.1" : h!);
      up.on("error", () => c.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"));
      up.on("connect", () => { c.write("HTTP/1.1 200 Connection established\r\n\r\n"); const rest = buf.slice(end + 4); if (rest) up.write(rest); c.pipe(up).pipe(c); });
    };
    c.on("data", onData);
  });
  track(srv); return { port: await listen(srv), seen };
}

/** Minimal SOCKS5 proxy (no-auth, or username/password); records requested targets. */
async function socksProxy(opts: { user?: string; pass?: string } = {}) {
  const seen: string[] = [];
  const srv = net.createServer((c) => {
    c.on("error", () => {});
    let state = 0; let buf = Buffer.alloc(0);
    c.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (state === 0 && buf.length >= 2 && buf.length >= 2 + buf[1]!) {
        const methods = [...buf.subarray(2, 2 + buf[1]!)]; buf = buf.subarray(2 + buf[1]!);
        if (opts.user !== undefined) { if (!methods.includes(2)) { c.end(Buffer.from([5, 0xff])); return; } c.write(Buffer.from([5, 2])); state = 1; } else { c.write(Buffer.from([5, 0])); state = 2; }
      }
      if (state === 1 && buf.length >= 2 && buf.length >= 3 + buf[1]! + buf[2 + buf[1]!]!) {
        const ul = buf[1]!; const u = buf.subarray(2, 2 + ul).toString(); const pl = buf[2 + ul]!; const p = buf.subarray(3 + ul, 3 + ul + pl).toString();
        buf = buf.subarray(3 + ul + pl);
        if (u !== opts.user || p !== opts.pass) { c.end(Buffer.from([1, 1])); return; }
        c.write(Buffer.from([1, 0])); state = 2;
      }
      if (state === 2 && buf.length >= 5) {
        const atyp = buf[3]!; const alen = atyp === 3 ? 1 + buf[4]! : atyp === 1 ? 4 : 16;
        if (buf.length < 4 + alen + 2) return;
        const host = atyp === 3 ? buf.subarray(5, 5 + buf[4]!).toString() : atyp === 1 ? [...buf.subarray(4, 8)].join(".") : "::1";
        const port = buf.readUInt16BE(4 + alen); seen.push(`${host}:${port}`); state = 3;
        const up = net.connect(port, host === "localhost" ? "127.0.0.1" : host);
        up.on("error", () => c.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0])));
        up.on("connect", () => { c.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0])); c.pipe(up).pipe(c); });
      }
    });
  });
  track(srv); return { port: await listen(srv), seen };
}

const roundTrip = (port: number, msg: string) => new Promise<string>((res, rej) => {
  const s = net.connect(port, "127.0.0.1", () => s.write(msg)); s.once("data", (d) => { res(d.toString()); s.destroy(); }); s.once("error", rej);
});

describe("HTTP CONNECT proxy", () => {
  it("carries bytes to the target and sends the requested host:port", async () => {
    const echo = await echoServer(); const p = await httpProxy();
    const t = await openProxyTunnel({ proxy: { type: "http", host: "127.0.0.1", port: p.port }, target: { host: "localhost", port: echo.port } });
    closers.push(() => t.close());
    expect(await roundTrip(t.localPort, "hi")).toBe("echo:hi");
    expect(p.seen.at(-1)!.target).toBe(`localhost:${echo.port}`);
  });
  it("sends Basic credentials and maps 407 to an auth error", async () => {
    const echo = await echoServer(); const good = `Basic ${Buffer.from("u:p").toString("base64")}`; const p = await httpProxy({ auth: good });
    const t = await openProxyTunnel({ proxy: { type: "http", host: "127.0.0.1", port: p.port, username: "u", password: "p" }, target: { host: "localhost", port: echo.port } });
    closers.push(() => t.close()); expect(await roundTrip(t.localPort, "x")).toBe("echo:x");
    await expect(openProxyTunnel({ proxy: { type: "http", host: "127.0.0.1", port: p.port, username: "u", password: "bad" }, target: { host: "localhost", port: echo.port } })).rejects.toMatchObject({ stage: "auth" });
  });
  it("reports refusal and unreachable proxies", async () => {
    const p = await httpProxy();
    await expect(openProxyTunnel({ proxy: { type: "http", host: "127.0.0.1", port: p.port }, target: { host: "localhost", port: 1 } })).rejects.toMatchObject({ stage: "refused" });
    await expect(openProxyTunnel({ proxy: { type: "http", host: "127.0.0.1", port: 1 }, target: { host: "localhost", port: 1 } })).rejects.toBeInstanceOf(ProxyError);
  });
});

describe("SOCKS5 proxy", () => {
  it("hands the host name to the proxy (no local DNS) and carries bytes", async () => {
    const echo = await echoServer(); const p = await socksProxy();
    const t = await openProxyTunnel({ proxy: { type: "socks5", host: "127.0.0.1", port: p.port }, target: { host: "localhost", port: echo.port } });
    closers.push(() => t.close());
    expect(await roundTrip(t.localPort, "ping")).toBe("echo:ping");
    expect(p.seen.at(-1)).toBe(`localhost:${echo.port}`);
  });
  it("supports username/password and rejects wrong ones", async () => {
    const echo = await echoServer(); const p = await socksProxy({ user: "bob", pass: "pw" });
    const t = await openProxyTunnel({ proxy: { type: "socks5", host: "127.0.0.1", port: p.port, username: "bob", password: "pw" }, target: { host: "127.0.0.1", port: echo.port } });
    closers.push(() => t.close()); expect(await roundTrip(t.localPort, "a")).toBe("echo:a");
    await expect(openProxyTunnel({ proxy: { type: "socks5", host: "127.0.0.1", port: p.port, username: "bob", password: "no" }, target: { host: "127.0.0.1", port: echo.port } })).rejects.toMatchObject({ stage: "auth" });
    await expect(openProxyTunnel({ proxy: { type: "socks5", host: "127.0.0.1", port: p.port }, target: { host: "127.0.0.1", port: echo.port } })).rejects.toMatchObject({ stage: "auth" });
  });
  it("reports a refused target", async () => {
    const p = await socksProxy();
    await expect(openProxyTunnel({ proxy: { type: "socks5", host: "127.0.0.1", port: p.port }, target: { host: "127.0.0.1", port: 1 } })).rejects.toMatchObject({ stage: "refused" });
  });
});

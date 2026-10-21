import net from "node:net";
import type { Tunnel } from "./tunnel.js";

export interface ProxySettings {
  type: "http" | "socks5";
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ProxyTunnelOptions { proxy: ProxySettings; target: { host: string; port: number }; connectTimeoutMs?: number }

export class ProxyError extends Error {
  constructor(message: string, readonly stage: "connect" | "auth" | "refused") { super(message); this.name = "ProxyError"; }
}

const readExactly = (s: net.Socket, n: number): Promise<Buffer> => new Promise((resolve, reject) => {
  let buf = Buffer.alloc(0);
  const onData = (d: Buffer) => { buf = Buffer.concat([buf, d]); if (buf.length >= n) { cleanup(); s.unshift(buf.subarray(n)); resolve(buf.subarray(0, n)); } };
  const onEnd = () => { cleanup(); reject(new ProxyError("Proxy closed the connection during the handshake", "connect")); };
  const cleanup = () => { s.pause(); s.off("data", onData); s.off("end", onEnd); s.off("error", reject); };
  s.on("data", onData); s.once("end", onEnd); s.once("error", reject); s.resume();
});

async function readHttpHead(s: net.Socket): Promise<{ status: number; line: string }> {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      const end = buf.indexOf("\r\n\r\n");
      if (end < 0) { if (buf.length > 16384) { cleanup(); reject(new ProxyError("Proxy response header too large", "connect")); } return; }
      cleanup(); s.unshift(buf.subarray(end + 4));
      const line = buf.subarray(0, buf.indexOf("\r\n")).toString("latin1");
      resolve({ status: Number(/^HTTP\/\d(?:\.\d)? (\d{3})/.exec(line)?.[1] ?? 0), line });
    };
    const onEnd = () => { cleanup(); reject(new ProxyError("Proxy closed the connection during CONNECT", "connect")); };
    const cleanup = () => { s.pause(); s.off("data", onData); s.off("end", onEnd); s.off("error", reject); };
    s.on("data", onData); s.once("end", onEnd); s.once("error", reject); s.resume();
  });
}

async function httpConnect(s: net.Socket, p: ProxySettings, t: { host: string; port: number }) {
  const hostPort = `${t.host.includes(":") ? `[${t.host}]` : t.host}:${t.port}`;
  const auth = p.username !== undefined ? `Proxy-Authorization: Basic ${Buffer.from(`${p.username}:${p.password ?? ""}`).toString("base64")}\r\n` : "";
  s.write(`CONNECT ${hostPort} HTTP/1.1\r\nHost: ${hostPort}\r\n${auth}\r\n`);
  const { status, line } = await readHttpHead(s);
  if (status === 407) throw new ProxyError("The proxy rejected the credentials (407)", "auth");
  if (status < 200 || status > 299) throw new ProxyError(`The proxy refused the tunnel: ${line}`, "refused");
}

const SOCKS_ERRORS: Record<number, string> = { 1: "general failure", 2: "not allowed by ruleset", 3: "network unreachable", 4: "host unreachable", 5: "connection refused", 6: "TTL expired", 7: "command not supported", 8: "address type not supported" };

async function socks5(s: net.Socket, p: ProxySettings, t: { host: string; port: number }) {
  const wantsAuth = p.username !== undefined;
  s.write(Buffer.from(wantsAuth ? [5, 2, 0, 2] : [5, 1, 0]));
  const [ver, method] = await readExactly(s, 2) as unknown as [number, number];
  if (ver !== 5) throw new ProxyError("Not a SOCKS5 proxy", "connect");
  if (method === 0xff) throw new ProxyError("The proxy accepts none of the offered authentication methods", "auth");
  if (method === 2) {
    const u = Buffer.from(p.username ?? "", "utf8"), pw = Buffer.from(p.password ?? "", "utf8");
    if (u.length > 255 || pw.length > 255) throw new ProxyError("Proxy credentials are too long for SOCKS5", "auth");
    s.write(Buffer.concat([Buffer.from([1, u.length]), u, Buffer.from([pw.length]), pw]));
    const r = await readExactly(s, 2);
    if (r[1] !== 0) throw new ProxyError("The proxy rejected the credentials", "auth");
  } else if (method !== 0) throw new ProxyError(`Unsupported SOCKS5 authentication method ${method}`, "auth");
  // The target name is sent as a domain (or literal IP) so the proxy resolves it: nothing is resolved locally.
  const ipv = net.isIP(t.host);
  const addr = ipv === 4 ? Buffer.concat([Buffer.from([1]), Buffer.from(t.host.split(".").map(Number))])
    : ipv === 6 ? Buffer.concat([Buffer.from([4]), ipv6Bytes(t.host)])
    : (() => { const h = Buffer.from(t.host, "utf8"); if (h.length > 255) throw new ProxyError("Host name too long for SOCKS5", "connect"); return Buffer.concat([Buffer.from([3, h.length]), h]); })();
  const port = Buffer.alloc(2); port.writeUInt16BE(t.port);
  s.write(Buffer.concat([Buffer.from([5, 1, 0]), addr, port]));
  const head = await readExactly(s, 4);
  if (head[1] !== 0) throw new ProxyError(`The proxy refused the tunnel: ${SOCKS_ERRORS[head[1]!] ?? `code ${head[1]}`}`, "refused");
  const rest = head[3] === 1 ? 4 + 2 : head[3] === 4 ? 16 + 2 : (await readExactly(s, 1))[0]! + 2;
  await readExactly(s, rest);
}

function ipv6Bytes(ip: string): Buffer {
  const [head = "", tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [], tl = tail ? tail.split(":") : [];
  const groups = [...h, ...Array(ip.includes("::") ? 8 - h.length - tl.length : 0).fill("0"), ...tl];
  return Buffer.concat(groups.map((g) => { const b = Buffer.alloc(2); b.writeUInt16BE(parseInt(g || "0", 16)); return b; }));
}

/** One connection to `target` through the proxy, handshake done; the returned socket carries the raw stream. */
export async function connectViaProxy(o: ProxyTunnelOptions): Promise<net.Socket> {
  const s = net.connect({ host: o.proxy.host, port: o.proxy.port });
  s.setNoDelay(true);
  const timer = setTimeout(() => s.destroy(new ProxyError("Timed out talking to the proxy", "connect")), o.connectTimeoutMs ?? 15000);
  try {
    await new Promise<void>((res, rej) => { s.once("connect", res); s.once("error", (e) => rej(new ProxyError(`Cannot reach the proxy: ${e.message}`, "connect"))); });
    s.removeAllListeners("error");
    s.on("error", () => {});
    const failed = new Promise<never>((_, rej) => s.once("error", rej));
    await Promise.race([o.proxy.type === "http" ? httpConnect(s, o.proxy, o.target) : socks5(s, o.proxy, o.target), failed]);
    return s;
  } catch (e) { s.destroy(); throw e; } finally { clearTimeout(timer); }
}

/**
 * Opens a local 127.0.0.1 listener that sends each connection through the proxy to `target` (same shape as the SSH tunnel,
 * so drivers just connect to localhost). The proxy is probed once up front so wrong settings fail at connect time.
 */
export async function openProxyTunnel(o: ProxyTunnelOptions): Promise<Tunnel> {
  (await connectViaProxy(o)).destroy();
  const sockets = new Set<net.Socket>();
  const server = net.createServer((client) => {
    sockets.add(client); client.on("close", () => sockets.delete(client)); client.on("error", () => {});
    client.pause();
    connectViaProxy(o).then((up) => {
      sockets.add(up); up.on("close", () => { sockets.delete(up); client.destroy(); }); up.on("error", () => client.destroy());
      client.on("close", () => up.destroy());
      client.pipe(up).pipe(client); client.resume();
    }, () => client.destroy());
  });
  await new Promise<void>((res, rej) => { server.once("error", rej); server.listen(0, "127.0.0.1", res); });
  return {
    localPort: (server.address() as net.AddressInfo).port,
    close: async () => { sockets.forEach((s) => s.destroy()); await new Promise<void>((r) => server.close(() => r())); },
  };
}

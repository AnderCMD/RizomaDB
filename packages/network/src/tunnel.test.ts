import { describe, it, expect, afterEach } from "vitest";
import net from "node:net";
import { Server, utils } from "ssh2";
import { HostKeyError, fingerprint, formatEntry, openTunnel, parseKnownHosts, checkHostKey } from "./index.js";
import { createHmac, randomBytes } from "node:crypto";

const closers: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const c of closers.splice(0).reverse()) await c(); });

const listen = (srv: net.Server) => new Promise<number>((res) => srv.listen(0, "127.0.0.1", () => res((srv.address() as net.AddressInfo).port)));

/** ssh2's generated ed25519 keys occasionally fail to parse back (seen once on Linux CI: "Malformed OpenSSH private key"); regenerate until they round-trip. */
function freshKeyPair() {
  for (let i = 0; i < 10; i++) {
    const k = utils.generateKeyPairSync("ed25519");
    if (!(utils.parseKey(k.private) instanceof Error)) return k;
  }
  throw new Error("could not generate a parseable ed25519 key");
}

function sshServer(opts: { password?: string } = {}) {
  const keys = freshKeyPair();
  const hostKey = keys.private;
  const pub = utils.parseKey(keys.public) as { getPublicSSH(): Buffer; type: string };
  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client.on("authentication", (ctx) => (ctx.method === "password" && ctx.password === (opts.password ?? "pw") ? ctx.accept() : ctx.reject(["password"])));
    client.on("ready", () => {
      client.on("session", () => {});
      client.on("tcpip", (accept, reject, info) => {
        const upstream = net.connect(info.destPort, info.destIP);
        upstream.once("connect", () => { const ch = accept(); ch.pipe(upstream).pipe(ch); ch.on("error", () => upstream.destroy()); });
        upstream.once("error", () => reject());
      });
    });
    client.on("error", () => {});
  });
  return { server, key: pub.getPublicSSH(), keyType: pub.type };
}

async function startSsh(opts?: { password?: string }) {
  const s = sshServer(opts);
  const port = await new Promise<number>((res) => s.server.listen(0, "127.0.0.1", () => res((s.server.address() as net.AddressInfo).port)));
  closers.push(() => new Promise<void>((r) => s.server.close(() => r())));
  return { ...s, port };
}

async function startEcho() {
  const srv = net.createServer((s) => { s.on("data", (d) => s.write(Buffer.concat([Buffer.from("echo:"), d]))); s.on("error", () => {}); });
  const port = await listen(srv);
  closers.push(() => new Promise<void>((r) => srv.close(() => r())));
  return port;
}

const roundTrip = (port: number, msg: string) => new Promise<string>((res, rej) => {
  const s = net.connect(port, "127.0.0.1"); s.once("data", (d) => { s.destroy(); res(d.toString()); }); s.once("error", rej); s.write(msg);
});

describe("ssh tunnel", () => {
  it("forwards traffic through a verified host", async () => {
    const ssh = await startSsh(), echo = await startEcho();
    const t = await openTunnel({ hops: [{ host: "127.0.0.1", port: ssh.port, username: "u", password: "pw" }], target: { host: "127.0.0.1", port: echo }, knownHosts: formatEntry("127.0.0.1", ssh.port, ssh.keyType, ssh.key) });
    closers.push(() => t.close());
    expect(await roundTrip(t.localPort, "hi")).toBe("echo:hi");
  });

  it("refuses unknown hosts (never auto-accepts) and reports the fingerprint", async () => {
    const ssh = await startSsh(), echo = await startEcho();
    const err = await openTunnel({ hops: [{ host: "127.0.0.1", port: ssh.port, username: "u", password: "pw" }], target: { host: "127.0.0.1", port: echo }, knownHosts: "" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HostKeyError);
    expect((err as HostKeyError).reason).toBe("unknown");
    expect((err as HostKeyError).fingerprint).toBe(fingerprint(ssh.key));
  });

  it("refuses a CHANGED host key (MITM)", async () => {
    const real = await startSsh(), impostor = sshServer(); 
    const port = await new Promise<number>((res) => impostor.server.listen(0, "127.0.0.1", () => res((impostor.server.address() as net.AddressInfo).port)));
    closers.push(() => new Promise<void>((r) => impostor.server.close(() => r())));
    const err = await openTunnel({ hops: [{ host: "127.0.0.1", port, username: "u", password: "pw" }], target: { host: "127.0.0.1", port: 1 }, knownHosts: formatEntry("127.0.0.1", port, real.keyType, real.key) }).catch((e: unknown) => e);
    expect((err as HostKeyError).reason).toBe("changed");
  });

  it("fails authentication with a wrong password", async () => {
    const ssh = await startSsh();
    await expect(openTunnel({ hops: [{ host: "127.0.0.1", port: ssh.port, username: "u", password: "bad" }], target: { host: "127.0.0.1", port: 1 }, knownHosts: formatEntry("127.0.0.1", ssh.port, ssh.keyType, ssh.key) })).rejects.toThrow(/authentication/i);
  });

  it("chains through a bastion (jump host)", async () => {
    const bastion = await startSsh(), inner = await startSsh({ password: "inner" }), echo = await startEcho();
    const kh = formatEntry("127.0.0.1", bastion.port, bastion.keyType, bastion.key) + formatEntry("127.0.0.1", inner.port, inner.keyType, inner.key);
    const t = await openTunnel({ hops: [{ host: "127.0.0.1", port: bastion.port, username: "b", password: "pw" }, { host: "127.0.0.1", port: inner.port, username: "i", password: "inner" }], target: { host: "127.0.0.1", port: echo }, knownHosts: kh });
    closers.push(() => t.close());
    expect(await roundTrip(t.localPort, "jump")).toBe("echo:jump");
  });
});

describe("known_hosts", () => {
  it("matches plain, bracketed-port and hashed entries", () => {
    const key = randomBytes(40);
    const salt = randomBytes(20);
    const hash = createHmac("sha1", salt).update("[db.example.com]:2222").digest();
    const text = `# comment\nplain.example.com,10.0.0.5 ssh-ed25519 ${key.toString("base64")}\n[other]:2200 ssh-ed25519 ${key.toString("base64")}\n|1|${salt.toString("base64")}|${hash.toString("base64")} ssh-ed25519 ${key.toString("base64")}\n`;
    const e = parseKnownHosts(text);
    expect(checkHostKey(e, "plain.example.com", 22, key).status).toBe("trusted");
    expect(checkHostKey(e, "10.0.0.5", 22, key).status).toBe("trusted");
    expect(checkHostKey(e, "other", 2200, key).status).toBe("trusted");
    expect(checkHostKey(e, "db.example.com", 2222, key).status).toBe("trusted");
    expect(checkHostKey(e, "db.example.com", 22, key).status).toBe("unknown");
    expect(checkHostKey(e, "plain.example.com", 22, randomBytes(40)).status).toBe("changed");
  });
});

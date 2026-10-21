import net from "node:net";
import { Client, type ConnectConfig } from "ssh2";
import { checkHostKey, fingerprint, parseKnownHosts, type HostKeyEntry } from "./knownHosts.js";

export class HostKeyError extends Error {
  constructor(readonly reason: "unknown" | "changed", readonly host: string, readonly port: number, readonly fingerprint: string, readonly keyType: string, readonly key: Buffer) {
    super(reason === "unknown"
      ? `Unknown SSH host key for ${host}:${port} (${fingerprint}). Verify it out-of-band and trust it explicitly.`
      : `SSH host key for ${host}:${port} CHANGED (${fingerprint}). This could be a man-in-the-middle attack. Connection refused.`);
    this.name = "HostKeyError";
  }
}

export interface SshHop {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  passphrase?: string;
  /** Path of an ssh-agent socket (e.g. SSH_AUTH_SOCK). */
  agent?: string;
}

export interface TunnelOptions {
  /** Hops in order; the last one forwards to the target. More than one = bastion/jump chain. */
  hops: SshHop[];
  target: { host: string; port: number };
  /** known_hosts contents (the user's and/or RizomaDB's own store). Required: hosts are never auto-trusted. */
  knownHosts: string | HostKeyEntry[];
  readyTimeoutMs?: number;
}

export interface Tunnel { localPort: number; close(): Promise<void> }

async function hopConnect(hop: SshHop, entries: HostKeyEntry[], via: Client | undefined, timeout: number): Promise<Client> {
  const port = hop.port ?? 22;
  const client = new Client();
  let hostKeyError: HostKeyError | undefined;
  const sock = via ? await new Promise<NodeJS.ReadableStream & NodeJS.WritableStream>((res, rej) => via.forwardOut("127.0.0.1", 0, hop.host, port, (e, s) => (e ? rej(e) : res(s)))) : undefined;
  const cfg: ConnectConfig = {
    host: hop.host, port, username: hop.username, readyTimeout: timeout, keepaliveInterval: 15000,
    ...(hop.password !== undefined ? { password: hop.password } : {}),
    ...(hop.privateKey ? { privateKey: hop.privateKey } : {}),
    ...(hop.passphrase ? { passphrase: hop.passphrase } : {}),
    ...(hop.agent ? { agent: hop.agent } : {}),
    ...(sock ? { sock: sock as never } : {}),
    hostVerifier: (key: Buffer) => {
      const d = checkHostKey(entries, hop.host, port, key);
      if (d.status === "trusted") return true;
      hostKeyError = new HostKeyError(d.status, hop.host, port, fingerprint(key), keyTypeOf(key), key);
      return false;
    },
  };
  await new Promise<void>((res, rej) => {
    client.once("ready", res);
    client.once("error", (e) => rej(hostKeyError ?? e));
    client.connect(cfg);
  });
  client.on("error", () => {});
  return client;
}

/** The key blob starts with a length-prefixed algorithm name. */
function keyTypeOf(blob: Buffer): string { const n = blob.readUInt32BE(0); return blob.subarray(4, 4 + n).toString(); }

/** Opens a local 127.0.0.1 listener that forwards each connection through the SSH chain to `target`. */
export async function openTunnel(o: TunnelOptions): Promise<Tunnel> {
  const entries = typeof o.knownHosts === "string" ? parseKnownHosts(o.knownHosts) : o.knownHosts;
  const clients: Client[] = [];
  const timeout = o.readyTimeoutMs ?? 15000;
  try {
    for (const hop of o.hops) clients.push(await hopConnect(hop, entries, clients.at(-1), timeout));
  } catch (e) { clients.forEach((c) => c.end()); throw e; }
  const last = clients.at(-1)!;
  const sockets = new Set<net.Socket>();
  const server = net.createServer((s) => {
    sockets.add(s); s.on("close", () => sockets.delete(s)); s.on("error", () => {});
    last.forwardOut(s.remoteAddress ?? "127.0.0.1", s.remotePort ?? 0, o.target.host, o.target.port, (e, ch) => {
      if (e) { s.destroy(); return; }
      ch.on("error", () => s.destroy()); s.pipe(ch).pipe(s);
    });
  });
  await new Promise<void>((res, rej) => { server.once("error", rej); server.listen(0, "127.0.0.1", res); });
  return {
    localPort: (server.address() as net.AddressInfo).port,
    close: async () => {
      sockets.forEach((s) => s.destroy());
      await new Promise<void>((r) => server.close(() => r()));
      clients.reverse().forEach((c) => c.end());
    },
  };
}

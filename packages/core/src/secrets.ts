import type { ResolvedConnectionConfig } from "@rizomadb/driver-api";
import type { ConnectionProfile } from "./profile.js";

/** Backed by VS Code SecretStorage in the extension; in-memory in tests. */
export interface SecretStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemorySecretStore implements SecretStore {
  private m = new Map<string, string>();
  async get(k: string) { return this.m.get(k); }
  async set(k: string, v: string) { this.m.set(k, v); }
  async delete(k: string) { this.m.delete(k); }
}

const secretRef = (profileId: string, key: string) => `rizomadb/${profileId}/${key}`;

/** Splits a raw config: secret values go to the store, the rest stays in the profile. */
export async function saveSecrets(store: SecretStore, profileId: string, secretKeys: string[], values: Record<string, unknown>) {
  const options: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (secretKeys.includes(k)) { if (typeof v === "string") await store.set(secretRef(profileId, k), v); }
    else options[k] = v;
  }
  return options;
}

export function expandVariables(v: unknown, env: Record<string, string | undefined>, vars: Record<string, string> = {}): unknown {
  if (typeof v === "string") {
    return v.replace(/\$\{(env|workspaceFolder)(?::([A-Za-z0-9_]+))?\}/g, (m, kind: string, name?: string) => {
      if (kind === "env") {
        const val = name ? env[name] : undefined;
        if (val === undefined) throw new Error(`Environment variable not set: ${name}`);
        return val;
      }
      return vars.workspaceFolder ?? m;
    });
  }
  if (Array.isArray(v)) return v.map((x) => expandVariables(x, env, vars));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expandVariables(x, env, vars)]));
  return v;
}

export async function resolveConfig(
  profile: ConnectionProfile, store: SecretStore,
  env: Record<string, string | undefined> = process.env, vars: Record<string, string> = {},
): Promise<ResolvedConnectionConfig> {
  const cfg = expandVariables(profile.options, env, vars) as Record<string, unknown>;
  for (const k of profile.secretKeys) {
    const s = await store.get(secretRef(profile.id, k));
    if (s !== undefined) cfg[k] = s;
  }
  return { ...cfg, readOnly: profile.readOnly };
}

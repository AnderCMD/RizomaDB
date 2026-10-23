import { readTextWithin } from "./fsTimeout.js";
import { z } from "zod";
import { ConnectionProfile, redactObject, REDACTED, type ConnectionProfile as Profile } from "@rizomadb/core";

/** Shared connection catalog (`.rizomadb/connections.json`): everything except secrets, safe to commit. */
const CatalogFile = z.object({ version: z.literal(1), connections: z.array(ConnectionProfile.extend({ folder: z.string().optional() })) });

const SECRET_KEY = /pass(word|wd)?|secret|token|api[-_]?key|private[-_]?key|credential|authorization|^uri$|connectionstring/i;

export interface CatalogResult { connections: (Profile & { source: string })[]; errors: string[] }

/** Finds anything that looks like a secret value stored in plain text inside a catalog entry. */
export function findSecrets(p: Profile): string[] {
  const hits: string[] = [];
  for (const [k, v] of Object.entries(p.options)) {
    // a declared secret may be listed in secretKeys (each user is prompted) but must not carry a value in the file
    if (p.secretKeys.includes(k)) { if (v !== "" && v !== undefined && v !== null) hits.push(k); continue; }
    if (SECRET_KEY.test(k) && v !== "" && v !== undefined && v !== null) hits.push(k);
    else if (typeof v === "string" && /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]*:[^/\s@]+@/i.test(v)) hits.push(k);
  }
  return hits;
}

export async function loadCatalog(files: { source: string; path: string }[], read: (path: string) => Promise<string> = readTextWithin): Promise<CatalogResult> {
  const out: CatalogResult = { connections: [], errors: [] };
  for (const f of files) {
    let text: string;
    try { text = await read(f.path); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") out.errors.push(`${f.source}: cannot read ${f.path}`); continue; }
    let parsed: z.infer<typeof CatalogFile>;
    try { parsed = CatalogFile.parse(JSON.parse(text)); } catch (e) { out.errors.push(`${f.source} (${f.path}): ${e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (e as Error).message}`); continue; }
    for (const c of parsed.connections) {
      const secrets = findSecrets(c);
      if (secrets.length) { out.errors.push(`${f.source}: connection "${c.name}" has secret values in plain text (${secrets.join(", ")}). It was NOT loaded. Remove them; list the key in "secretKeys" so each user is asked for it.`); continue; }
      // later files (project, user) override earlier ones (team) by id; each user's own secrets stay in their SecretStorage
      const i = out.connections.findIndex((x) => x.id === c.id);
      const entry = { ...c, source: f.source };
      if (i >= 0) out.connections[i] = entry; else out.connections.push(entry);
    }
  }
  return out;
}

export { redactObject, REDACTED };

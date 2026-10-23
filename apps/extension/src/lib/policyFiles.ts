import { readTextWithin } from "./fsTimeout.js";
import { builtInPolicy, mergePolicies, parsePolicy, type EffectivePolicy, type PolicyFile } from "@rizomadb/core";

export interface PolicySources {
  /** Whether the built-in "prod is read-only" default applies (a user preference on the lowest layer). */
  builtinProdReadOnly: boolean;
  /** Layers in any order: team (settings/system), project files (only when the workspace is trusted), user file. */
  files: { label: string; path: string }[];
  /** Inline layers, e.g. from VS Code settings pushed by an administrator. */
  inline?: { label: string; value: unknown }[];
}

export interface LoadedPolicy { policy: EffectivePolicy; errors: string[]; loaded: string[] }

/** A policy that cannot be understood must not silently weaken protection: it turns the whole environment read-only. */
const FAIL_CLOSED: PolicyFile = { version: 1, environments: {}, defaults: { readOnly: true }, disable: [], maskColumns: [] };

export async function loadPolicy(src: PolicySources): Promise<LoadedPolicy> {
  const layers: PolicyFile[] = [src.builtinProdReadOnly ? builtInPolicy : { ...builtInPolicy, environments: { staging: builtInPolicy.environments.staging ?? {}, prod: { confirmDestructive: true, confirmWrites: true } } }];
  const errors: string[] = [], loaded: string[] = [];
  for (const f of src.files) {
    let text: string;
    try { text = await readTextWithin(f.path); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") continue; errors.push(`${f.label}: cannot read ${f.path}: ${(e as Error).message}`); layers.push(FAIL_CLOSED); continue; }
    try { layers.push(parsePolicy(text)); loaded.push(f.label); } catch (e) { errors.push(`${f.label} (${f.path}): ${(e as Error).message}`); layers.push(FAIL_CLOSED); }
  }
  for (const i of src.inline ?? []) {
    if (i.value === undefined || i.value === null || (typeof i.value === "object" && Object.keys(i.value as object).length === 0)) continue;
    try { layers.push(parsePolicy(JSON.stringify(i.value))); loaded.push(i.label); } catch (e) { errors.push(`${i.label}: ${(e as Error).message}`); layers.push(FAIL_CLOSED); }
  }
  return { policy: mergePolicies(...layers), errors, loaded };
}

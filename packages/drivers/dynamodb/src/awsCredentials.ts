import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AwsKeys { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region?: string }
export class AwsProfileError extends Error {}

type Ini = Record<string, Record<string, string>>;
/** Reads the INI dialect of ~/.aws/credentials and ~/.aws/config: `[section]`, `key = value`, `#` and `;` comments. */
export function parseIni(text: string): Ini {
  const out: Ini = {}; let cur: Record<string, string> | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) { cur = out[sec[1]!.trim()] ??= {}; continue; }
    const eq = line.indexOf("=");
    if (cur && eq > 0) cur[line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim();
  }
  return out;
}

const UNSUPPORTED = ["sso_start_url", "sso_session", "role_arn", "credential_process", "source_profile", "web_identity_token_file", "credential_source"];

/**
 * Access keys of a named profile from the shared credentials file (AWS_SHARED_CREDENTIALS_FILE or ~/.aws/credentials); the region comes from
 * the config file when the profile has one. Profiles that need SSO, role assumption or a helper program are refused with a clear message:
 * those flows call AWS services this driver does not implement.
 */
export function loadAwsProfile(profile: string, env: NodeJS.ProcessEnv = process.env, read: (path: string) => string = (p) => readFileSync(p, "utf8")): AwsKeys {
  const credPath = env.AWS_SHARED_CREDENTIALS_FILE || join(homedir(), ".aws", "credentials");
  const confPath = env.AWS_CONFIG_FILE || join(homedir(), ".aws", "config");
  const tryRead = (p: string): string | undefined => { try { return read(p); } catch { return undefined; } };
  const credText = tryRead(credPath), confText = tryRead(confPath);
  const creds = credText ? parseIni(credText) : {}, conf = confText ? parseIni(confText) : {};
  const confSection = conf[profile === "default" ? "default" : `profile ${profile}`] ?? {};
  const section = creds[profile] ?? {};
  for (const k of UNSUPPORTED) if (k in section || k in confSection) throw new AwsProfileError(`The AWS profile "${profile}" uses ${k}, which is not supported: export temporary access keys and paste them instead.`);
  if (credText === undefined && confText === undefined) throw new AwsProfileError(`No AWS credentials file found at ${credPath}.`);
  const accessKeyId = section.aws_access_key_id, secretAccessKey = section.aws_secret_access_key;
  if (!accessKeyId || !secretAccessKey) throw new AwsProfileError(`The AWS profile "${profile}" has no access keys in ${credPath}.`);
  const region = confSection.region ?? section.region;
  return { accessKeyId, secretAccessKey, ...(section.aws_session_token ? { sessionToken: section.aws_session_token } : {}), ...(region ? { region } : {}) };
}

/** Keys from the standard environment variables, when both are set. */
export function awsKeysFromEnv(env: NodeJS.ProcessEnv = process.env): AwsKeys | undefined {
  const accessKeyId = env.AWS_ACCESS_KEY_ID, secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey, ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}), ...(env.AWS_REGION || env.AWS_DEFAULT_REGION ? { region: env.AWS_REGION ?? env.AWS_DEFAULT_REGION! } : {}) } : undefined;
}

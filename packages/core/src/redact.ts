const SENSITIVE_KEY = /pass(word|wd)?|secret|token|api[-_]?key|private[-_]?key|credential|authorization/i;

export const REDACTED = "«redacted»";

/** Deep-copies a value replacing sensitive keys' values; used for logs, history and diagnostics. */
export function redactObject(v: unknown, extraSecrets: string[] = []): unknown {
  if (typeof v === "string") return redactString(v, extraSecrets);
  if (Array.isArray(v)) return v.map((x) => redactObject(x, extraSecrets));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE_KEY.test(k) ? REDACTED : redactObject(x, extraSecrets)]));
  }
  return v;
}

export function redactString(s: string, secrets: string[] = []): string {
  let out = s.replace(/([a-z][a-z0-9+.-]*:\/\/[^:\/\s]*:)[^@\s]+@/gi, `$1${REDACTED}@`);
  out = out.replace(/(pass(?:word|wd)?\s*[=:]\s*)('[^']*'|"[^"]*"|\S+)/gi, `$1${REDACTED}`);
  for (const sec of secrets) if (sec.length >= 4) out = out.split(sec).join(REDACTED);
  return out;
}

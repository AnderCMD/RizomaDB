/** Static risk classification of a Flux script. Default-deny for anything with side effects or external access. */
export function stripFlux(src: string): string {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i]!, n = src[i + 1];
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"') { i++; while (i < src.length && src[i] !== '"') { if (src[i] === "\\") i++; i++; } i++; out += ' "" '; continue; }
    out += c; i++;
  }
  return out;
}

// Imports are read from the original text because string contents are stripped above.
const RISKY_IMPORT = /import\s+(?:\w+\s+)?"(?:experimental\/)?(?:http|mqtt|sql|socket|influxdata\/influxdb\/secrets|experimental\/aws|experimental\/prometheus|contrib\/[\w/]+|pagerduty|slack|opsgenie|teams|telegram|sensu|victorops)"/;

export function assessFlux(command: string): { risk: "none" | "write" | "destructive"; reasons: string[] } {
  const reasons: string[] = [];
  const code = stripFlux(command);
  if (!code.trim()) return { risk: "none", reasons };
  if (/(^|[^\w.])(?:\w+\.)?to\s*\(/.test(code)) reasons.push("to() writes points into a bucket");
  if (RISKY_IMPORT.test(command)) reasons.push("Imports a package that reaches outside InfluxDB (HTTP, SQL, messaging, secrets) or has side effects");
  if (/\btask\b\s*=|\boption\s+task\b/.test(code)) reasons.push("Defines a task");
  return { risk: reasons.length ? "write" : "none", reasons };
}

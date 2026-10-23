import { readFile } from "node:fs/promises";

/** Reads a text file but gives up after `ms`: a file on a disconnected network drive or a stalled cloud folder never answers, and must not hold the extension's start-up. */
export function readTextWithin(path: string, ms = 8000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms / 1000} s (is the folder available?)`), { code: "ETIMEDOUT" })), ms);
    readFile(path, "utf8").then((t) => { clearTimeout(timer); resolve(t); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

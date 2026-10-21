import { Decimal128, Long, ObjectId, Binary, UUID } from "mongodb";

export class MongoSyntaxError extends Error {
  constructor(message: string, readonly position: number) { super(message); this.name = "MongoSyntaxError"; }
}

export interface ParsedCommand { target: "db" | "collection"; database?: string; collection?: string; method: string; args: unknown[]; chain: { method: string; args: unknown[] }[] }

type Tok = { t: "id" | "str" | "num" | "punct" | "regex" | "eof"; v: string; pos: number; flags?: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const prevAllowsRegex = () => { const p = out.at(-1); return !p || (p.t === "punct" && /[(,:[{]/.test(p.v)); };
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); if (e < 0) throw new MongoSyntaxError("Unterminated comment", i); i = e + 2; continue; }
    if (c === '"' || c === "'") {
      const start = i; let s = ""; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") {
          const n = src[i + 1];
          if (n === "u") { const h = src.slice(i + 2, i + 6); if (!/^[0-9a-fA-F]{4}$/.test(h)) throw new MongoSyntaxError("Bad \\u escape", i); s += String.fromCharCode(parseInt(h, 16)); i += 6; continue; }
          s += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "0": "\0" } as Record<string, string>)[n ?? ""] ?? n ?? ""; i += 2; continue;
        }
        s += src[i++];
      }
      if (i >= src.length) throw new MongoSyntaxError("Unterminated string", start);
      i++; out.push({ t: "str", v: s, pos: start }); continue;
    }
    if (c === "/" && prevAllowsRegex()) {
      const start = i; i++; let body = ""; let cls = false;
      while (i < src.length && (src[i] !== "/" || cls)) { if (src[i] === "\\") { body += src[i]! + (src[i + 1] ?? ""); i += 2; continue; } if (src[i] === "[") cls = true; else if (src[i] === "]") cls = false; if (src[i] === "\n") throw new MongoSyntaxError("Unterminated regular expression", start); body += src[i++]; }
      if (i >= src.length) throw new MongoSyntaxError("Unterminated regular expression", start);
      i++; let flags = ""; while (i < src.length && /[a-z]/.test(src[i]!)) flags += src[i++];
      out.push({ t: "regex", v: body, pos: start, flags }); continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? "")) || (c === "-" && /[0-9.]/.test(src[i + 1] ?? "") && prevAllowsRegex())) {
      const m = /^-?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
      if (!m) throw new MongoSyntaxError("Bad number", i);
      out.push({ t: "num", v: m[0], pos: i }); i += m[0].length; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))!; out.push({ t: "id", v: m[0], pos: i }); i += m[0].length; continue; }
    if (/[(){}[\],:.;-]/.test(c)) { out.push({ t: "punct", v: c, pos: i }); i++; continue; }
    throw new MongoSyntaxError(`Unexpected character "${c}"`, i);
  }
  out.push({ t: "eof", v: "", pos: src.length });
  return out;
}

const CONSTRUCTORS: Record<string, (a: unknown[], pos: number) => unknown> = {
  ObjectId: (a, p) => { try { return a.length ? new ObjectId(String(a[0])) : new ObjectId(); } catch { throw new MongoSyntaxError("ObjectId needs a 24-character hex string", p); } },
  ISODate: (a, p) => date(a, p), Date: (a, p) => date(a, p),
  NumberLong: (a) => Long.fromString(String(a[0] ?? 0)), NumberInt: (a) => Math.trunc(Number(a[0] ?? 0)), NumberDecimal: (a) => Decimal128.fromString(String(a[0] ?? "0")),
  UUID: (a) => (a.length ? new UUID(String(a[0])) : new UUID()),
  BinData: (a) => new Binary(Buffer.from(String(a[1] ?? ""), "base64"), Number(a[0] ?? 0)),
};
function date(a: unknown[], p: number) { const d = a.length ? new Date(a[0] as string | number) : new Date(); if (Number.isNaN(d.getTime())) throw new MongoSyntaxError("Invalid date", p); return d; }

/** Evaluates a relaxed-JSON / shell-style value without eval: objects, arrays, strings, numbers, regex, constructors. */
class P {
  private i = 0; private depth = 0;
  constructor(private toks: Tok[]) {}
  peek() { return this.toks[this.i]!; }
  next() { return this.toks[this.i++]!; }
  accept(v: string) { const t = this.peek(); if (t.t === "punct" && t.v === v) { this.i++; return true; } return false; }
  expect(v: string) { if (!this.accept(v)) throw new MongoSyntaxError(`Expected "${v}"`, this.peek().pos); }
  ident() { const t = this.next(); if (t.t !== "id") throw new MongoSyntaxError("Expected a name", t.pos); return t.v; }

  value(): unknown {
    if (++this.depth > 100) throw new MongoSyntaxError("Nesting is too deep", this.peek().pos);
    try { return this.value0(); } finally { this.depth--; }
  }
  private value0(): unknown {
    const t = this.next();
    switch (t.t) {
      case "str": return t.v;
      case "num": { const n = Number(t.v); return Number.isSafeInteger(n) || !/^-?\d+$/.test(t.v) ? n : Long.fromString(t.v); }
      case "regex": try { return new RegExp(t.v, t.flags); } catch { throw new MongoSyntaxError("Invalid regular expression", t.pos); }
      case "punct":
        if (t.v === "{") return this.object();
        if (t.v === "[") { const a: unknown[] = []; while (!this.accept("]")) { a.push(this.value()); if (!this.accept(",")) { this.expect("]"); break; } } return a; }
        if (t.v === "-") { const n = this.next(); if (n.t === "id" && n.v === "Infinity") return -Infinity; throw new MongoSyntaxError("Unexpected \"-\"", t.pos); }
        throw new MongoSyntaxError(`Unexpected "${t.v}"`, t.pos);
      case "id": {
        if (t.v === "true") return true; if (t.v === "false") return false; if (t.v === "null") return null; if (t.v === "undefined") return undefined;
        if (t.v === "NaN") return NaN; if (t.v === "Infinity") return Infinity;
        if (t.v === "new") return this.value();
        const ctor = CONSTRUCTORS[t.v];
        if (!ctor) throw new MongoSyntaxError(`Unknown function "${t.v}" (supported: ${Object.keys(CONSTRUCTORS).join(", ")})`, t.pos);
        this.expect("("); const args = this.args(); return ctor(args, t.pos);
      }
      default: throw new MongoSyntaxError("Unexpected end of input", t.pos);
    }
  }
  object(): Record<string, unknown> {
    const o: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    while (!this.accept("}")) {
      const k = this.next();
      if (k.t !== "id" && k.t !== "str" && k.t !== "num") throw new MongoSyntaxError("Expected a key", k.pos);
      if (k.v === "__proto__") throw new MongoSyntaxError("Key __proto__ is not allowed", k.pos);
      this.expect(":"); o[k.v] = this.value();
      if (!this.accept(",")) { this.expect("}"); break; }
    }
    return { ...o };
  }
  args(): unknown[] { const a: unknown[] = []; while (!this.accept(")")) { a.push(this.value()); if (!this.accept(",")) { this.expect(")"); break; } } return a; }

  command(): ParsedCommand {
    const db = this.ident();
    if (db !== "db") throw new MongoSyntaxError('Commands start with "db." (for example db.users.find({}))', 0);
    this.expect(".");
    let name = this.ident();
    let database: string | undefined;
    if (name === "getSiblingDB") { this.expect("("); database = String(this.args()[0]); this.expect("."); name = this.ident(); }
    let target: ParsedCommand["target"] = "collection", collection: string | undefined;
    if (name === "getCollection") { this.expect("("); const a = this.args(); collection = String(a[0]); this.expect("."); name = this.ident(); }
    else if (this.peek().v === "(") target = "db";
    else { collection = name; this.expect("."); name = this.ident(); }
    this.expect("("); const args = this.args();
    const chain: ParsedCommand["chain"] = [];
    while (this.accept(".")) { const m = this.ident(); this.expect("("); chain.push({ method: m, args: this.args() }); }
    this.accept(";");
    if (this.peek().t !== "eof") throw new MongoSyntaxError("Unexpected text after the command", this.peek().pos);
    return { target, ...(database ? { database } : {}), ...(collection ? { collection } : {}), method: name, args, chain };
  }
}

export function parseMongoCommand(text: string): ParsedCommand { return new P(lex(text.trim())).command(); }
export function parseMongoValue(text: string): unknown { const p = new P(lex(text)); const v = p.value(); if (p.peek().t !== "eof") throw new MongoSyntaxError("Unexpected text", p.peek().pos); return v; }

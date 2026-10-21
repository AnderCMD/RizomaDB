import { MongoSyntaxError, parseCommandWith, plainFactory } from "./parserCore.js";

export type Risk = "none" | "write" | "destructive";
export interface Assessment { risk: Risk; reasons: string[] }

const READ_COLLECTION = new Set(["find", "findOne", "countDocuments", "estimatedDocumentCount", "distinct", "getIndexes", "aggregate", "explain"]);
const READ_DB = new Set(["stats", "getCollectionNames", "listCollections", "serverStatus", "hello", "version"]);
const READ_COMMANDS = new Set(["ping", "find", "count", "distinct", "aggregate", "listcollections", "listindexes", "dbstats", "collstats", "buildinfo", "hello", "ismaster", "serverstatus", "listdatabases", "connectionstatus", "explain"]);
const DESTRUCTIVE = new Set(["drop", "dropDatabase", "dropIndexes", "dropIndex"]);

const isEmpty = (x: unknown) => x === undefined || (typeof x === "object" && x !== null && Object.keys(x as object).length === 0);
const hasOut = (pipeline: unknown) => Array.isArray(pipeline) && pipeline.some((s) => s && typeof s === "object" && ("$out" in (s as object) || "$merge" in (s as object)));

/** Classifies a shell-lite command. Unparseable text is never executed (it fails with a syntax error), so it carries no risk. */
export function assessMongo(text: string): Assessment {
  let c;
  try { c = parseCommandWith(text, plainFactory); } catch (e) { if (e instanceof MongoSyntaxError) return { risk: "none", reasons: [] }; throw e; }
  const reasons: string[] = [];
  const m = c.method;
  if (c.target === "db") {
    if (m === "runCommand") {
      const doc = c.args[0] as Record<string, unknown> | undefined;
      const name = doc ? Object.keys(doc)[0]?.toLowerCase() ?? "" : "";
      if (READ_COMMANDS.has(name) && !(name === "aggregate" && hasOut(doc?.pipeline))) return { risk: "none", reasons };
      return { risk: /^(drop|dropdatabase|dropindexes|shutdown|killop|fsync)/.test(name) ? "destructive" : "write", reasons: [`Command ${name || "?"} may modify data`] };
    }
    if (READ_DB.has(m)) return { risk: "none", reasons };
    return { risk: m === "dropDatabase" ? "destructive" : "write", reasons: [`db.${m}() modifies the server`] };
  }
  if (DESTRUCTIVE.has(m)) return { risk: "destructive", reasons: [`${m}() removes data or structure`] };
  if (m === "aggregate") return hasOut(c.args[0]) ? { risk: "write", reasons: ["$out/$merge writes to a collection"] } : { risk: "none", reasons };
  if (READ_COLLECTION.has(m)) return { risk: "none", reasons };
  if ((m === "deleteMany" || m === "updateMany") && isEmpty(c.args[0])) return { risk: "destructive", reasons: [`${m}() with an empty filter affects every document`] };
  if (m === "remove" && isEmpty(c.args[0])) return { risk: "destructive", reasons: ["remove() with an empty filter deletes every document"] };
  return { risk: "write", reasons: [`${m}() modifies data`] };
}

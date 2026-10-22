import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { redactString } from "@rizomadb/core";

export interface Favorite {
  id: string;
  connectionId: string;
  connectionName: string;
  environment: string;
  sql: string;
  addedAt: string;
}

/** Queries the user starred. Kept apart from the history so clearing or pruning the history never drops them. SQL is redacted before it is written. */
export class Favorites {
  constructor(private file: string, private now: () => Date = () => new Date()) {}

  static idOf(connectionId: string, sql: string): string {
    return createHash("sha256").update(connectionId).update("\0").update(sql.trim()).digest("hex").slice(0, 24);
  }

  async list(): Promise<Favorite[]> {
    try {
      const data = JSON.parse(await readFile(this.file, "utf8")) as { favorites?: Favorite[] };
      return Array.isArray(data.favorites) ? data.favorites.filter((f) => typeof f?.id === "string" && typeof f.sql === "string") : [];
    } catch { return []; }
  }

  private async save(all: Favorite[]) {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ version: 1, favorites: all }, null, 1), { mode: 0o600 });
  }

  /** Stars the query, or un-stars it when it already is. Returns the new state. */
  async toggle(e: Omit<Favorite, "id" | "addedAt">): Promise<boolean> {
    const all = await this.list(), id = Favorites.idOf(e.connectionId, e.sql);
    if (all.some((f) => f.id === id)) { await this.save(all.filter((f) => f.id !== id)); return false; }
    await this.save([{ ...e, id, sql: redactString(e.sql.trim()), addedAt: this.now().toISOString() }, ...all]);
    return true;
  }
}

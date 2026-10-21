declare module "pg-cursor" {
  import type { Submittable } from "pg";
  export default class Cursor<T = unknown[]> implements Submittable {
    constructor(text: string, values?: unknown[], config?: { rowMode?: "array"; types?: unknown });
    submit: Submittable["submit"];
    read(n: number): Promise<T[]>;
    close(cb?: (err?: Error) => void): void;
  }
}

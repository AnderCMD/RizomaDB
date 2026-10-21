import type { ExecuteRequest, ResultEvent } from "./types.js";
export declare function collect(it: AsyncIterable<ResultEvent>): Promise<{
    columns: import("./types.js").ColumnInfo[];
    rows: import("./types.js").Value[][];
    done: {
        type: "done";
        rowCount: number;
        affectedRows?: number;
        durationMs: number;
    } | undefined;
}>;
export type { ExecuteRequest };

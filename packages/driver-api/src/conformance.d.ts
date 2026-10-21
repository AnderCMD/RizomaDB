import { type DriverPlugin, type ResolvedConnectionConfig } from "./index.js";
export interface ConformanceOptions {
    plugin: DriverPlugin;
    /** Config for a fresh, empty, writable database. */
    config: () => Promise<ResolvedConnectionConfig> | ResolvedConnectionConfig;
    /** SQL that blocks for ~seconds, to exercise cancellation. */
    slowSql: string;
    /** Two-parameter query returning (a, b), in the dialect's placeholder syntax. */
    paramSql: string;
    /** Config that must fail to authenticate/connect. */
    badConfig?: () => ResolvedConnectionConfig;
}
/** Every driver must pass this kit. */
export declare function runConformance(opts: ConformanceOptions): void;

export type DriverErrorKind = "connection" | "authentication" | "syntax" | "permission" | "timeout" | "cancelled" | "constraint" | "unsupported" | "unknown";
export declare class DriverError extends Error {
    readonly kind: DriverErrorKind;
    readonly options: {
        position?: number;
        code?: string;
        cause?: unknown;
    };
    constructor(kind: DriverErrorKind, message: string, options?: {
        position?: number;
        code?: string;
        cause?: unknown;
    });
    get position(): number | undefined;
    get code(): string | undefined;
}

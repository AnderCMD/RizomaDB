export type DriverErrorKind =
  | "connection" | "authentication" | "syntax" | "permission"
  | "timeout" | "cancelled" | "constraint" | "unsupported" | "unknown";

export class DriverError extends Error {
  constructor(
    readonly kind: DriverErrorKind,
    message: string,
    readonly options: { position?: number; code?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "DriverError";
  }
  get position(): number | undefined { return this.options.position; }
  get code(): string | undefined { return this.options.code; }
}

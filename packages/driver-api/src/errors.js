export class DriverError extends Error {
    kind;
    options;
    constructor(kind, message, options = {}) {
        super(message, { cause: options.cause });
        this.kind = kind;
        this.options = options;
        this.name = "DriverError";
    }
    get position() { return this.options.position; }
    get code() { return this.options.code; }
}

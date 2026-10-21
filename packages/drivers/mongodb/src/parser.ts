import { Binary, Decimal128, Long, ObjectId, UUID } from "mongodb";
import { MongoSyntaxError, parseCommandWith, parseValueWith, type Factory, type ParsedCommand } from "./parserCore.js";

export { MongoSyntaxError, type ParsedCommand };

const bson: Factory = {
  objectId: (h) => (h ? new ObjectId(h) : new ObjectId()), long: (s) => Long.fromString(s), decimal: (s) => Decimal128.fromString(s), uuid: (s) => (s ? new UUID(s) : new UUID()),
  binary: (sub, b64) => new Binary(Buffer.from(b64, "base64"), sub),
};

export function parseMongoCommand(text: string): ParsedCommand { return parseCommandWith(text, bson); }
export function parseMongoValue(text: string): unknown { return parseValueWith(text, bson); }

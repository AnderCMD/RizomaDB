import { defineConfig } from "vitest/config";
// CockroachDB schema changes take seconds; the conformance kit runs against it too.
export default defineConfig({ test: { testTimeout: 30_000 } });

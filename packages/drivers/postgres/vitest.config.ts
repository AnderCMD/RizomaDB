import { defineConfig } from "vitest/config";
// CockroachDB/YugabyteDB schema changes take seconds, and CI runners are slow.
export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000 } });

import { defineConfig } from "vitest/config";
// Engine suites run against containers; CI runners are slower than a developer machine.
export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000 } });

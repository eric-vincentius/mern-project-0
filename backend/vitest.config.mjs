import {defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.mjs"],
        environment: "node",
        fileParallelism: false,
        testTimeout: 120000,
        hookTimeout: 120000,
        experimental: { viteModuleRunner: false },
    }
})
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    projects: [
      { extends: true, test: { name: "website", include: ["tests/*.test.ts"] } },
      // dashboard (predashboard core): every file gets a fresh in-memory PostgreSQL
      {
        extends: true,
        test: { name: "dashboard", include: ["tests/dashboard/**/*.test.ts"], setupFiles: ["tests/dashboard/setup.ts"], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
      },
    ],
  },
});

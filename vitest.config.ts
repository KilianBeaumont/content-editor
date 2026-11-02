import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{shared,backend,frontend}/src/**/*.test.ts"],
    environment: "node",
  },
});

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: "node20",
  outDir: "dist",
  platform: "node",
  nodeProtocol: true,
  unused: {
    level: "error",
    ignore: ["@fastify/view", "bcryptjs", "mysql2", "pg", "sqlite3"],
  },
});

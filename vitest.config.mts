import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // Testes de banco falam com o Supabase remoto.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      // Carrega o .env.local; o .env.test.local (projeto Supabase só de testes)
      // tem prioridade quando existe.
      ...loadEnv(mode, process.cwd(), ""),
      // Garante que os testes não dependem do fuso da máquina.
      TZ: "UTC",
    },
  },
}));

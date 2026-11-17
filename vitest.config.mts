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
    // A limpeza de cada arquivo apaga clínicas inteiras pela rede; com o banco
    // de testes lento, 60 s não bastavam e o arquivo falhava mesmo com os testes certos.
    hookTimeout: 120_000,
    // Um arquivo por vez: em paralelo, o Supabase de testes recusa por limite de taxa.
    fileParallelism: false,
    env: {
      // Carrega o .env.local; o .env.test.local (projeto Supabase só de testes)
      // tem prioridade quando existe.
      ...loadEnv(mode, process.cwd(), ""),
      // Garante que os testes não dependem do fuso da máquina.
      TZ: "UTC",
    },
  },
}));

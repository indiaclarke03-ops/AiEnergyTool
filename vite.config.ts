/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Metered chat (M5): forward /api to the local proxy (npm run server).
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  preview: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { chunkSizeWarningLimit: 2500 }, // the lazily-loaded tokenizer ranks file is ~2.3 MB
  test: {
    include: ["tests/engine/**/*.test.ts", "tests/server/**/*.test.ts"],
    environment: "node",
  },
});

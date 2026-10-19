/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 2500 }, // the lazily-loaded tokenizer ranks file is ~2.3 MB
  test: {
    include: ["tests/engine/**/*.test.ts"],
    environment: "node",
  },
});

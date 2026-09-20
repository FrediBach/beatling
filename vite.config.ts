import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sites } from "./build/sites-vite-plugin.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), sites()],
  resolve: {
    alias: { "@": import.meta.dirname + "/src" },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});

import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    preact(),
    tailwindcss(),
    ...(mode === "standalone" ? [viteSingleFile()] : []),
  ],
  define: { __STANDALONE__: JSON.stringify(mode === "standalone") },
  build: {
    outDir: mode === "standalone" ? ".generated" : "dist",
    ...(mode === "standalone"
      ? {
          copyPublicDir: false,
          rolldownOptions: { output: { format: "iife" } },
        }
      : {}),
  },
  server: { host: "0.0.0.0" },
}));

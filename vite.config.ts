import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "standalone" ? [viteSingleFile()] : []),
  ],
  define: { __STANDALONE__: JSON.stringify(mode === "standalone") },
  build: {
    outDir: mode === "standalone" ? ".generated" : "dist",
    ...(mode === "standalone" ? { copyPublicDir: false } : {}),
  },
  server: { host: "0.0.0.0" },
}));

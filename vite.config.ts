import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { miniToolCss } from "./scripts/minitool-css.mjs";
import { transformAsync } from "@babel/core";
import unicodePropertyRegex from "@babel/plugin-transform-unicode-property-regex";
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    ...(mode === "minitool" ? [{
      name: "minitool-css-baseline",
      enforce: "pre" as const,
      transform(code: string, id: string) {
        // All component styles are plain CSS; Tailwind's layered reset cannot run on Chrome 61.
        if (id.endsWith("/src/style.css")) return miniToolCss(code);
        if (id.includes("/node_modules/marked/")) return transformAsync(code, {
          configFile: false, babelrc: false, plugins: [unicodePropertyRegex],
        }).then((result) => result?.code);
      },
    }] : []),
    preact(),
    tailwindcss(),
    ...(mode === "standalone" ? [viteSingleFile()] : []),
  ],
  define: {
    __STANDALONE__: JSON.stringify(mode === "standalone" || mode === "minitool"),
    __MINITOOL__: JSON.stringify(mode === "minitool"),
  },
  build: {
    outDir: mode === "minitool" ? ".generated/minitool" : mode === "standalone" ? ".generated" : "dist",
    ...(mode === "minitool" ? {
      target: ["es2017", "chrome61"],
      cssTarget: "chrome61",
      cssCodeSplit: false,
      copyPublicDir: false,
      rolldownOptions: { input: "minitool.html", output: { format: "iife", entryFileNames: "app.js", assetFileNames: "[name][extname]" } },
    } : {}),
    ...(mode === "standalone"
      ? {
          copyPublicDir: false,
          rolldownOptions: { output: { format: "iife" } },
        }
      : {}),
  },
  server: { host: "0.0.0.0" },
}));

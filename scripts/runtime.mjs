import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// The single-file plugin puts the entire app in <head>. Keep only the tiny
// startup shell there, so streamed HTML can paint before the app and asset pack.
const generated = readFileSync(".generated/index.html", "utf8");
const resources = [];
const template = generated
  .replace(/<head>([\s\S]*?)<\/head>/i, (_, head) => {
    const lightHead = head.replace(
      /<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,
      (tag) => {
        if (tag.startsWith('<style id="boot-style"')) return tag;
        resources.push(
          tag.replace(/<script\b[^>]*type="module"[^>]*>/i, "<script>"),
        );
        return "";
      },
    );
    return `<head>${lightHead}</head>`;
  })
  .replace(
    "</body>",
    () =>
      `${resources.sort((a, b) => Number(b.startsWith("<style")) - Number(a.startsWith("<style"))).join("\n")}\n</body>`,
  );
if (!resources.length || !template.includes('id="boot-screen"'))
  throw new Error("Standalone template is missing startup resources");
mkdirSync("public", { recursive: true });
writeFileSync("public/standalone.html", template);

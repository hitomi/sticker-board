import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import JSZip from "jszip";

const directory = ".generated/minitool";
const zip = new JSZip();
for (const name of readdirSync(directory)) {
  if (!/\.(html|js|css)$/.test(name)) throw new Error(`Unexpected mini tool resource: ${name}`);
  let content = readFileSync(`${directory}/${name}`, "utf8");
  if (name === "minitool.html") {
    content = content.replace(/<script\b[^>]*src="([^\"]*app\.js)"[^>]*><\/script>/, "")
      .replace("</body>", '<script src="./app.js"></script></body>');
    if (/type="module"/.test(content)) throw new Error("Mini tool must use classic scripts");
  }
  zip.file(name === "minitool.html" ? "index.html" : name, content);
}
writeFileSync("public/minitool-runtime.zip", await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

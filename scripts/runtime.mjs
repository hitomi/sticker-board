import { copyFileSync } from "node:fs";
copyFileSync(".generated/index.html", "public/standalone.html");

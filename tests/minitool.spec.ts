import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";

async function exported(page: Page, target: "browser" | "minitool", uploads = false, publishing = true) {
  await page.getByRole("button", { name: "导出独立版", exact: true }).click();
  await page.getByLabel("导出版本").selectOption(target);
  if (uploads) {
    await page.getByRole("switch", { name: "允许用户导入贴纸", exact: true }).check();
    await page.getByRole("switch", { name: "允许用户导入背景", exact: true }).check();
  }
  if (target === "minitool" && publishing) await page.getByRole("switch", { name: "允许发小红书笔记", exact: true }).check();
  if (target === "minitool") await expect(page.getByRole("switch", { name: "允许用户导入 ZIP", exact: true })).toBeDisabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: target === "minitool" ? "下载小红书小工具 ZIP" : "下载独立版 ZIP", exact: true }).click();
  const download = await pending;
  return JSZip.loadAsync(await readFile((await download.path())!));
}
async function serve(zip: JSZip): Promise<{ url: string; server: Server }> {
  const files = new Map<string, Buffer>();
  for (const entry of Object.values(zip.files)) if (!entry.dir) files.set(`/${entry.name}`, await entry.async("nodebuffer"));
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    const file = files.get(path === "/" ? "/index.html" : path);
    if (!file) { response.writeHead(404); response.end(); return; }
    const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : "text/html";
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-src 'none'");
    response.end(file);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>';

test("exports both formats, respects CSP, saves and posts via native APIs, opens exported artwork without drafts and restores ZIP backup", async ({ page, context }, info) => {
  const errors: string[] = [];
  await page.goto("/");
  await page.getByRole("button", { name: /^添加/ }).first().click();
  await page.getByLabel("导入背景图片文件", { exact: true }).setInputFiles({ name: "背景.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
  const dimensions = await page.locator(".dimension-pill").innerText();
  // Confirm the main app still commits its browser draft before reopening it.
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("sticker-studio", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("workspaces", "readonly");
      const draft = transaction.objectStore("workspaces").get("studio:/");
      transaction.oncomplete = () => { db.close(); resolve(draft.result?.canvas?.scene?.objects?.length || 0); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }))).toBe(1);
  await page.reload();
  await expect(page.locator(".canvas-footer")).toContainText("1 张贴纸");
  await expect(page.locator(".dimension-pill")).toHaveText(dimensions);
  const browserZip = await exported(page, "browser");
  expect(browserZip.file("使用说明.txt")).toBeTruthy();
  await page.getByRole("dialog").getByRole("button", { name: "关闭", exact: true }).click();
  const zip = await exported(page, "minitool", true);
  const html = await zip.file("index.html")!.async("string");
  expect(html).not.toMatch(/type="module"|<script[^>]*>\s*[^<\s]|\son\w+=/);
  expect(Object.keys(zip.files).filter((name) => !zip.files[name].dir)).toEqual(expect.arrayContaining(["index.html", "app.js", "style.css", "pack.js", "sticker-config.json"]));
  expect(Object.keys(zip.files).every((name) => zip.files[name].dir || /\.(html|css|js|json|png|jpg|jpeg|gif|webp|svg)$/.test(name))).toBeTruthy();
  const js = await zip.file("app.js")!.async("string");
  expect(js).not.toMatch(/\bfetch\(|\bXMLHttpRequest\b|\beval\(|new Function\(|\.download\s*=|\b(?:indexedDB|localStorage|sessionStorage|getStorage|getStorageInfo|setStorage|removeStorage|clearStorage)\b/);
  expect(await zip.file("style.css")!.async("string")).not.toMatch(/@layer|@property/);
  const config = JSON.parse(await zip.file("sticker-config.json")!.async("string"));
  expect(Object.keys(config.assets)).toHaveLength(13); // The placed sticker shares its library asset; the background adds one.
  await writeFile(info.outputPath("小红书小工具.zip"), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  await mkdir(info.outputPath("package"), { recursive: true });
  for (const file of Object.values(zip.files)) if (!file.dir) {
    const path = info.outputPath("package", file.name);
    await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await writeFile(path, await file.async("nodebuffer"));
  }
  const { url, server } = await serve(zip);
  const mini = await context.newPage();
  mini.on("pageerror", (error) => errors.push(error.message));
  mini.on("dialog", (dialog) => dialog.accept());
  const calls: { method: string; options: any }[] = [];
  let denySave = true;
  await mini.exposeFunction("nativeCall", async (method: string, options: any) => {
    calls.push({ method, options });
    if (["getStorage", "getStorageInfo", "setStorage", "removeStorage", "clearStorage"].includes(method)) throw new Error("Storage forbidden");
    if (method === "writeTempFile") return { filePath: "tmp/generated.png" };
    if (method === "saveImageToPhotosAlbum" && denySave) throw new Error("permission denied");
    return {};
  });
  await mini.addInitScript(() => {
    const target = window as any;
    target.xhs = { launchOptions: { miniToolEnv: { buildVersion: 9462004 } }, miniTool: {} };
    for (const method of ["getStorage", "getStorageInfo", "setStorage", "removeStorage", "clearStorage", "writeTempFile", "saveImageToPhotosAlbum", "postNote"]) target.xhs.miniTool[method] = (options: any) => target.nativeCall(method, options);
    // Exercise the actual local fallbacks, including Fabric/Markdown dependencies.
    for (const name of ["flat", "flatMap", "at"]) delete (Array.prototype as any)[name];
    delete (Object as any).fromEntries;
    delete (Promise as any).allSettled;
    delete (Promise.prototype as any).finally;
    delete (String.prototype as any).matchAll;
    delete (HTMLImageElement.prototype as any).decode;
    delete target.ResizeObserver;
  });
  try {
    await mini.goto(url);
    await expect(mini.getByRole("button", { name: "导出图片", exact: true })).toBeEnabled();
    await expect(mini.getByRole("button", { name: "导入 ZIP", exact: true })).toHaveCount(0);
    await expect(mini.getByRole("button", { name: "导出独立版", exact: true })).toHaveCount(0);
    await expect(mini.locator(".dimension-pill")).toHaveText(dimensions);
    await expect(mini.locator(".canvas-footer").getByText("1 张贴纸", { exact: false })).toBeVisible();
    await mini.getByRole("button", { name: "导出图片", exact: true }).click();
    await mini.getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("alert")).toContainText("保存失败");
    await expect(mini.getByAltText("画布成品预览")).toBeVisible();
    denySave = false;
    await mini.getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("status")).toContainText("图片已保存到相册");
    await mini.getByRole("button", { name: "发小红书笔记", exact: true }).click();
    await expect.poll(() => calls.filter((call) => call.method === "postNote").length).toBe(1);
    expect(calls.find((call) => call.method === "postNote")!.options).toEqual({ pageType: "photo_publish", mediaInfo: { image_resources: [{ url: "tmp/generated.png" }] } });
    expect(calls.find((call) => call.method === "writeTempFile")!.options.data).toMatch(/^data:image\/png;base64,/);
    await mini.getByRole("dialog").getByRole("button", { name: "关闭", exact: true }).click();
    await mini.getByLabel("导入贴纸图片", { exact: true }).setInputFiles({ name: "新贴纸.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg.replace("</svg>", `<desc>${"x".repeat(600000)}</desc></svg>`)) });
    await mini.getByRole("button", { name: "添加新贴纸", exact: true }).click();
    await expect(mini.locator(".canvas-footer").getByText("2 张贴纸", { exact: false })).toBeVisible();
    await expect(mini.getByRole("status")).toHaveCount(0);
    await mini.reload();
    await expect(mini.locator(".canvas-footer").getByText("1 张贴纸", { exact: false })).toBeVisible();
    await expect(mini.getByRole("button", { name: "添加新贴纸", exact: true })).toHaveCount(0);
    expect(calls.filter((call) => /Storage/.test(call.method))).toEqual([]);
    await mini.setViewportSize({ width: 390, height: 844 });
    await mini.getByRole("button", { name: "贴纸库", exact: true }).click();
    await expect(mini.getByRole("dialog")).toBeVisible();
    await mini.screenshot({ path: info.outputPath("mobile.png"), animations: "disabled" });
    expect(errors).toEqual([]);
  } finally { await mini.close(); server.close(); }
  await page.getByRole("dialog").getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("恢复独立版配置文件").setInputFiles({ name: "小工具.zip", mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) });
  await expect(page.getByRole("dialog", { name: "恢复配置", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "替换并恢复", exact: true }).click();
  await expect(page.locator(".canvas-footer")).toContainText("1 张贴纸");
});

test("unavailable native APIs keep the preview and permit retry without a browser download", async ({ page, context }) => {
  await page.goto("/");
  const { url, server } = await serve(await exported(page, "minitool"));
  const mini = await context.newPage();
  let downloads = 0;
  mini.on("download", () => downloads++);
  try {
    await mini.goto(url);
    await mini.getByRole("button", { name: "导出图片", exact: true }).click();
    await mini.getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("alert")).toContainText("保存失败");
    await mini.getByRole("button", { name: "发小红书笔记", exact: true }).click();
    await expect(mini.getByRole("alert")).toContainText("无法打开笔记发布页");
    await expect(mini.getByAltText("画布成品预览")).toBeVisible();
    expect(downloads).toBe(0);
  } finally { await mini.close(); server.close(); }
});

test("rejects oversized ZIPs before downloading", async ({ page }) => {
  await page.goto("/");
  // Random bytes are deliberately incompressible: this tests the final ZIP budget.
  const bytes = randomBytes(11 * 1024 * 1024).toString("base64");
  const message = await page.evaluate(async (bytes) => {
    const { buildMiniTool } = await import("/src/minitoolExport.ts");
    try {
      await buildMiniTool({ name: "大素材", stickers: [{ id: "big", name: "big", category: "big", src: `data:image/png;base64,${bytes}` }] });
      return "unexpected success";
    } catch (error) { return (error as Error).message; }
  }, bytes);
  expect(message).toContain("超过 10 MB 上限");
});

test("publishing off saves directly, hides posting, and retains a retry preview after failure", async ({ page, context }) => {
  await page.goto("/");
  const { url, server } = await serve(await exported(page, "minitool", false, false));
  const mini = await context.newPage();
  let saves = 0;
  let deny = false;
  await mini.exposeFunction("album", () => {
    saves++;
    if (deny) throw new Error("permission denied");
    return {};
  });
  await mini.addInitScript(() => {
    const target = window as any;
    target.xhs = { miniTool: { saveImageToPhotosAlbum: (options: any) => target.album(options) } };
  });
  try {
    await mini.goto(url);
    await mini.getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("status")).toContainText("图片已保存到相册");
    await expect(mini.getByRole("dialog")).toHaveCount(0);
    expect(saves).toBe(1);
    deny = true;
    await mini.getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("alert")).toContainText("保存失败");
    await expect(mini.getByRole("button", { name: "发小红书笔记", exact: true })).toHaveCount(0);
    deny = false;
    await mini.getByRole("dialog").getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("status")).toContainText("图片已保存到相册");
    expect(saves).toBe(3);
  } finally { await mini.close(); server.close(); }
});

async function blockBrowserStorage(page: Page) {
  await page.addInitScript(() => {
    const target = window as any;
    target.storageAccesses = [];
    const blocked = (name: string) => {
      target.storageAccesses.push(name);
      throw new DOMException(`${name} unavailable`, "SecurityError");
    };
    for (const name of ["indexedDB", "localStorage", "sessionStorage", "caches"])
      Object.defineProperty(window, name, { get() { return blocked(name); } });
    Object.defineProperty(document, "cookie", { get() { return blocked("cookie"); }, set() { blocked("cookie"); } });
  });
}

test("mini tool never touches storage; header and dialogs avoid the native toolbar and safe areas", async ({ page, context }, info) => {
  await page.goto("/");
  const zip = await exported(page, "minitool", false, false);
  const { url, server } = await serve(zip);
  const mini = await context.newPage();
  const errors: string[] = [];
  mini.on("pageerror", (error) => errors.push(error.message));
  await blockBrowserStorage(mini);
  await mini.addInitScript(() => {
    const target = window as any;
    const miniTool = {};
    for (const name of ["getStorage", "getStorageInfo", "setStorage", "removeStorage", "clearStorage"])
      Object.defineProperty(miniTool, name, { get() {
        target.storageAccesses.push(name);
        throw new Error("Native storage forbidden");
      } });
    target.xhs = { miniTool };
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.setProperty("--safe-area-inset-top", "47px");
      document.documentElement.style.setProperty("--safe-area-inset-bottom", "28px");
      document.documentElement.style.setProperty("--safe-area-inset-left", "0px");
      document.documentElement.style.setProperty("--safe-area-inset-right", "0px");
      // The supplied simulator document reports only the status-bar inset;
      // simulate its separate overlaid native navigation row below that inset.
      const toolbar = document.createElement("div");
      toolbar.className = "simulated-native-toolbar";
      toolbar.setAttribute("aria-hidden", "true");
      toolbar.style.cssText = "position:fixed;top:47px;left:0;right:0;height:44px;z-index:10000;display:flex;align-items:center;justify-content:space-between;padding:0 16px";
      toolbar.innerHTML = "<span>‹</span><span>↗ ···</span>";
      document.body.appendChild(toolbar);
    });
  });
  try {
    await mini.setViewportSize({ width: 390, height: 844 });
    await mini.goto(url);
    await expect(mini.getByRole("button", { name: "保存到相册", exact: true })).toBeVisible();
    await expect(mini.getByText("无法读取本地数据，原数据未被修改。", { exact: true })).toHaveCount(0);
    await expect(mini.getByText("临时模式", { exact: false })).toHaveCount(0);
    const toolbar = await mini.locator(".simulated-native-toolbar").boundingBox();
    const header = await mini.locator(".header").boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(toolbar!.y + toolbar!.height + 4);
    const nav = await mini.locator(".mobile-nav").boundingBox();
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(844 - 28);
    await mini.getByRole("button", { name: "贴纸库", exact: true }).click();
    const drawer = await mini.getByRole("dialog").boundingBox();
    expect(drawer!.y).toBeGreaterThanOrEqual(header!.y);
    await mini.getByRole("button", { name: /^添加/ }).first().click();
    await expect(mini.getByRole("dialog")).toHaveCount(0);
    await expect(mini.locator(".canvas-footer")).toContainText("1 张贴纸");
    await mini.screenshot({ path: info.outputPath("safe-area.png"), animations: "disabled" });
    expect(await mini.evaluate(() => (window as any).storageAccesses)).toEqual([]);
    await mini.reload();
    await expect(mini.locator(".canvas-footer")).toContainText("0 张贴纸");
    expect(await mini.evaluate(() => (window as any).storageAccesses)).toEqual([]);
    // A landscape viewport uses its side insets and keeps the image preview
    // completely inside the remaining content area, including its close button.
    await mini.setViewportSize({ width: 844, height: 390 });
    await mini.evaluate(() => {
      const style = document.documentElement.style;
      style.setProperty("--safe-area-inset-top", "0px");
      style.setProperty("--safe-area-inset-bottom", "21px");
      style.setProperty("--safe-area-inset-left", "47px");
      style.setProperty("--safe-area-inset-right", "47px");
      (document.querySelector(".simulated-native-toolbar") as HTMLElement).style.top = "0px";
    });
    await mini.getByRole("button", { name: "保存到相册", exact: true }).click();
    await expect(mini.getByRole("alert")).toContainText("保存失败");
    const preview = await mini.getByRole("dialog").boundingBox();
    expect(preview!.y).toBeGreaterThanOrEqual(48);
    expect(preview!.y + preview!.height).toBeLessThanOrEqual(390 - 21);
    expect(preview!.x).toBeGreaterThanOrEqual(47);
    expect(preview!.x + preview!.width).toBeLessThanOrEqual(844 - 47);
    expect(await mini.evaluate(() => (window as any).storageAccesses)).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await mini.close(); server.close(); }
});

test("no SDK or safe-area variables still opens directly with no draft or temporary-mode page", async ({ page, context }) => {
  await page.goto("/");
  const { url, server } = await serve(await exported(page, "minitool", false, false));
  const mini = await context.newPage();
  await blockBrowserStorage(mini);
  try {
    await mini.setViewportSize({ width: 390, height: 844 });
    await mini.goto(url);
    await expect(mini.getByRole("button", { name: "保存到相册", exact: true })).toBeVisible();
    await expect(mini.getByText("临时模式", { exact: false })).toHaveCount(0);
    await expect(mini.getByRole("status")).toHaveCount(0);
    const header = await mini.locator(".header").boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(48);
    await mini.getByRole("button", { name: "贴纸库", exact: true }).click();
    await mini.getByRole("button", { name: /^添加/ }).first().click();
    await expect(mini.getByRole("dialog")).toHaveCount(0);
    await expect(mini.locator(".canvas-footer")).toContainText("1 张贴纸");
    expect(await mini.evaluate(() => (window as any).storageAccesses)).toEqual([]);
    await mini.reload();
    await expect(mini.locator(".canvas-footer")).toContainText("0 张贴纸");
    expect(await mini.evaluate(() => (window as any).storageAccesses)).toEqual([]);
  } finally { await mini.close(); server.close(); }
});
